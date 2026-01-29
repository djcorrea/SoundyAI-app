# 🎵 GUIA TÉCNICO DE ANÁLISE DE MÚSICA - SoundyAI

**Versão:** 2.0  
**Última atualização:** 29 de janeiro de 2026  
**Alinhamento:** 100% consistente com Documento Técnico Oficial v1.0

---

## 📋 ÍNDICE

1. [Introdução - Para Quem é Este Guia](#1-introdução---para-quem-é-este-guia)
2. [Definições Oficiais (Métricas Técnicas)](#2-definições-oficiais-métricas-técnicas)
3. [Modo Streaming vs Modo Pista (Por Gênero)](#3-modo-streaming-vs-modo-pista-por-gênero)
4. [O Que Enviar: Pré-Master vs Master](#4-o-que-enviar-pré-master-vs-master)
5. [Passo a Passo SoundyAI (Fluxo Oficial)](#5-passo-a-passo-soundyai-fluxo-oficial)
6. [Como Interpretar Score e Tabela Comparativa](#6-como-interpretar-score-e-tabela-comparativa)
7. [Como Seguir as Sugestões Inteligentes](#7-como-seguir-as-sugestões-inteligentes)
8. [Análise de Referência (Feature Mais Poderosa)](#8-análise-de-referência-feature-mais-poderosa)
9. [Como Usar o Chatbot Contextual](#9-como-usar-o-chatbot-contextual)
10. [Ordem de Correção (Por Que Importa)](#10-ordem-de-correção-por-que-importa)
11. [Boas Práticas e Limitações](#11-boas-práticas-e-limitações)
12. [Checklist Final Rápido](#12-checklist-final-rápido)
13. [Problemas Comuns & Soluções](#13-problemas-comuns--soluções)
14. [Checklist de Validação Interna](#14-checklist-de-validação-interna)

---

## 1. INTRODUÇÃO - PARA QUEM É ESTE GUIA

### Público-Alvo

Este guia é para **produtores musicais, DJs e engenheiros de áudio** que precisam de **análises técnicas objetivas** sobre qualidade de mixagem e masterização.

**Perfis ideais:**
- DJs e produtores (profissionais ou amadores) que produzem faixas eletrônicas/urbanas
- Engenheiros de áudio validando trabalhos antes da entrega final
- Músicos que querem entender como sua produção se compara com referências de mercado

### Gêneros Focados

A SoundyAI possui análise especializada para:
- **Funk** (Mandela, Bruxaria, BH)
- **EDM** (Electronic Dance Music)
- **Progressive Trance**
- **Música Eletrônica em Geral**

Cada gênero possui **targets (alvos) específicos** baseados em análises de faixas profissionais reais do mercado.

### O Que Este Guia Resolve

Responde perguntas técnicas objetivas:
- Meu áudio está alto o suficiente para o gênero?
- O grave está balanceado corretamente para o estilo?
- Estou tendo clipping ou distorção digital?
- Como minha música se compara com referências profissionais?

### ⚠️ IMPORTANTE - Leia Primeiro

**A SoundyAI é uma ferramenta de análise técnica. Ela NÃO substitui:**
- Ouvido humano
- Experiência artística
- Intenção criativa

**Música é arte.** O score reflete **aderência técnica ao gênero**, não qualidade artística absoluta. Use as métricas como **guia técnico**, não como **regra absoluta**.

---

## 2. DEFINIÇÕES OFICIAIS (MÉTRICAS TÉCNICAS)

### LUFS (Loudness Units relative to Full Scale)

**Padrão:** ITU-R BS.1770-4

**O que é:**  
Métrica padronizada de percepção de volume sonoro. Mede o "quão alto" o cérebro humano percebe o áudio.

**Por que importa:**  
Define o volume percebido da música. Plataformas de streaming normalizam áudios para um LUFS específico. Se sua música estiver muito alta ou baixa, será ajustada automaticamente.

**Alvos por gênero (exemplos SoundyAI):**
- Funk/EDM de pista: **-8.3 LUFS** (alto impacto)
- Streaming Spotify: **-14 LUFS** (padrão de normalização)
- Progressive Trance: varia conforme subgênero

**Impacto prático:**
- LUFS muito baixo → música sem presença
- LUFS muito alto → risco de distorção/cansaço auditivo

---

### True Peak (dBTP - Decibels True Peak)

**Método:** Medição inter-sample com oversampling 4x

**O que é:**  
Pico absoluto do sinal após oversampling, detectando picos que ocorrem **entre amostras digitais** (inter-sample peaks).

**Por que importa:**  
Previne clipping digital durante conversão D/A (digital para analógico) em sistemas de reprodução. True Peak acima de 0 dBTP pode causar distorção em alto-falantes e compressores de streaming.

**Alvo recomendado:**
- **Seguro:** ≤ -1.0 dBTP
- **Ideal:** ≤ -1.5 dBTP (margem de segurança)

**Impacto prático:**  
True Peak > 0 dBTP gera distorção digital audível (cliques, crunches).

---

### DR (Dynamic Range - Amplitude Dinâmica)

**O que é:**  
Diferença em dB entre os trechos mais altos e mais baixos da música.

**Por que importa:**  
Define o "espaço para respirar" da música. Alta dinâmica = sons naturais. Baixa dinâmica = som constante/"agressivo".

**Alvos típicos por gênero:**
- Funk/EDM de pista: **6-10 DR** (mais comprimido)
- Trance melódico: **8-12 DR**
- Música dinâmica: **> 12 DR**

**Impacto prático:**
- DR muito baixo (< 6) → som cansativo, "tijolaço"
- DR muito alto → pode parecer fraco em sistemas de PA

---

### Crest Factor

**O que é:**  
Relação entre o pico do sinal e o RMS (Root Mean Square), medida em dB.

**Por que importa:**  
Indica o headroom disponível para transientes (ataques de bateria, drops). Crest Factor baixo indica compressão excessiva.

**Alvo típico:**  
8-12 dB para música eletrônica.

**Impacto prático:**
- Muito baixo → música sem punch
- Muito alto → volume percebido baixo

---

### Estéreo (Correlação e Largura)

**O que é:**  
Mede a diferença entre canais Left e Right.

**Valores de referência:**
- **+1** = mono (canais idênticos)
- **0** = estéreo descorrelacionado
- **-1** = anti-fase (problemático)

**Alvo recomendado:**  
Correlação entre **0.3 e 0.7** (estéreo balanceado)

**Por que importa:**  
Correlação negativa pode causar cancelamento de fase em sistemas mono (celulares, rádio).

**Impacto prático:**
- Correlação > 0.8 → som mono, sem espacialidade
- Correlação negativa → problemas em mono

---

### Análise de Frequências (6 Bandas)

A SoundyAI divide o espectro em **6 bandas espectrais**:

| Banda | Faixa (Hz) | Conteúdo Típico |
|-------|-----------|-----------------|
| **Sub** | 20-60 | Sub-grave, energia do kick |
| **Grave** | 60-250 | Grave fundamental, corpo do baixo |
| **Low-Mid** | 250-500 | Médio-grave, corpo de vocais/instrumentos |
| **Mid** | 500-2000 | Médios, presença e clareza |
| **High-Mid** | 2000-4000 | Médio-agudos, definição |
| **Brilho** | 4000-20000 | Agudos, ar e sparkle |

**Tolerâncias típicas:**
- Sub/Grave: ±3 dB (mais sensível)
- Médios: ±4 dB
- Agudos: ±5 dB (menos sensível)

---

## 3. MODO STREAMING VS MODO PISTA (POR GÊNERO)

### 🎯 CONCEITO CENTRAL

**A SoundyAI compara por gênero, NÃO por regra universal.**

- **-14 LUFS** é referência de streaming/padronização (Spotify, YouTube)
- **-8.3 LUFS** é alvo típico para Funk/EDM de pista (alto impacto)
- **Cada gênero tem seu próprio target**

### Por Que -14 LUFS Não é Regra Universal?

**Contexto importa:**

1. **Streaming (Spotify/YouTube):** Normaliza para -14 LUFS. Se sua música estiver em -8 LUFS, será reduzida. Se estiver em -20 LUFS, será aumentada.

2. **Pista (DJ Set/Club):** Precisa competir com outras faixas alto impacto. Alvos típicos: -8 a -10 LUFS.

3. **Masterização comercial:** Pode variar entre -8 e -12 LUFS dependendo do gênero e intenção.

### Como a SoundyAI Funciona

**Você escolhe o gênero → Sistema compara com targets daquele gênero.**

**Exemplo prático:**
- **Gênero selecionado:** Funk Mandela
- **Alvo LUFS:** -8.3 LUFS
- **Alvo True Peak:** -1.0 dBTP
- **Sua música:** -16.5 LUFS
- **Diferença:** -98.8% (muito mais baixo que o padrão do gênero)

**Interpretação:** Para Funk de pista, sua música está tecnicamente abaixo do impacto esperado. Para streaming, estaria próximo do ideal (-14 LUFS).

### Quando Usar Cada Modo

| Objetivo | Alvo LUFS Recomendado |
|----------|----------------------|
| Lançamento em streaming (Spotify, YouTube) | -14 LUFS |
| DJ set / Pista / Club | -8 a -10 LUFS (conforme gênero) |
| Masterização comercial (geral) | -10 a -12 LUFS |
| Análise técnica na SoundyAI | Usar target do gênero selecionado |

---

## 4. O QUE ENVIAR: PRÉ-MASTER VS MASTER

### Opção A: Enviar Pré-Master (Mixagem Limpa)

**Características:**
- Mix equilibrada, volumes ajustados
- SEM limiter no master (ou apenas safety leve)
- Picos abaixo de 0 dBFS
- Nível médio não exagerado

**Vantagens:**
- Análise mais precisa de relações de volume, dinâmica e espectro
- Sugestões focam em problemas de mix, não de mastering

**Quando usar:**
- Você quer feedback sobre a mix antes de masterizar
- Está testando versões iniciais
- Quer validar balanceamento tonal

---

### Opção B: Enviar Master (Versão Finalizada)

**Características:**
- Limiter/Maximizer aplicado
- True Peak controlado (≤ -1.0 dBTP)
- LUFS ajustado para o target do gênero

**Vantagens:**
- Análise reflete a versão final que será lançada
- Comparação direta com referências de mercado

**Quando usar:**
- Você quer validar o master final
- Está comparando com referências profissionais
- Vai lançar a música em breve

---

### ⚠️ Recomendação Oficial

**Para análise mais útil:** Envie pré-master primeiro (identificar problemas de mix), depois reanálise o master final (validar resultado).

---

## 5. PASSO A PASSO SOUNDYAI (FLUXO OFICIAL)

### Visão Geral do Fluxo

```
Upload → Seleção de Gênero → Análise → Score/Métricas → Tabela Comparativa → 
Sugestões → Aplicar Correções → Reanálise
```

---

### Passo 1: Upload do Áudio

1. Clique em **"Análise de áudio"** no menu lateral
2. Leia o modal de boas-vindas (recomendado)
3. Arraste arquivo ou clique em **"Escolher Arquivo"**

**Formatos suportados:**
- WAV (recomendado)
- FLAC (recomendado)
- MP3 (aceito, mas menos preciso)
- Tamanho máximo: 150MB

**Por que essa ordem:** Começar com formato correto garante análise precisa.

---

### Passo 2: Seleção do Gênero de Referência

**Antes do upload, escolha o gênero no dropdown.**

**Opções disponíveis:**
- Progressive Trance
- Funk Mandela
- Funk Bruxaria
- Funk BH
- EDM
- Eletrônico

**Por que essa ordem:** O gênero define os alvos de comparação. Gênero errado = sugestões inadequadas.

---

### Passo 3: Aguardar Análise

**O sistema processa em etapas:**
1. Upload para servidor
2. Análise de métricas principais (LUFS, True Peak, Dinâmica)
3. Análise de frequências (6 bandas)
4. Comparação com referência do gênero
5. Geração de sugestões inteligentes

**Tempo médio:** 30 segundos a 2 minutos

**Por que essa ordem:** Cada etapa depende da anterior. Interromper pode resultar em análise incompleta.

---

### Passo 4: Interpretação da Tela de Resultados

**Após análise, você verá:**

**1. Score Final (0-100)**  
Métrica geral de aderência técnica ao gênero.

**2. Métricas Principais**  
Loudness, True Peak, Dinâmica, Estéreo (valores individuais).

**3. Análise de Frequências**  
Distribuição de energia em 6 bandas espectrais.

**4. Tabela Comparativa**  
Comparação direta: seu áudio vs referência do gênero.

**5. Sugestões Inteligentes**  
Lista de ajustes recomendados com prioridade.

**Por que essa ordem:** Score dá visão geral → Métricas revelam problemas → Sugestões indicam correções.

---

### Passo 5: Leitura da Tabela Comparativa

**Colunas:**
- **Valor:** Sua métrica atual
- **Alvo:** Referência do gênero
- **Diferença (%):** Desvio percentual
- **Status:** Severidade visual (cor)

**Interpretação de cores:**
- 🟢 **Verde (OK):** Dentro da tolerância (0-15% desvio)
- 🟡 **Amarelo (Atenção):** Desvio moderado (15-30%)
- 🔴 **Vermelho (Crítico):** Desvio grande (> 30%)

**Por que essa ordem:** Contextualiza os números. Valores isolados podem ser mal interpretados.

---

### Passo 6: Aplicação das Sugestões

**Ordem de priorização automática:**

1. ⚠️ **Correções críticas** (True Peak > 0 dBTP, clipping)
2. 🔊 **Ajustes de loudness** (LUFS muito baixo/alto)
3. 🎚️ **Balanceamento de frequências** (grave/agudos)
4. ✨ **Refinamentos finais** (dinâmica, estéreo)

**Por que essa ordem:**
- Corrigir clipping antes de loudness evita distorção adicional
- Ajustar frequências após loudness garante balanceamento tonal no volume final

---

### Passo 7: Reanálise

**Após aplicar correções na DAW:**

1. Exporte novamente (WAV ou FLAC)
2. Faça novo upload na SoundyAI
3. Compare novo score e métricas com análise anterior

**Por que essa ordem:** Valida que correções foram efetivas e não criaram novos problemas.

---

## 6. COMO INTERPRETAR SCORE E TABELA COMPARATIVA

### O Que o Score Representa

**Score Final (0-100) combina:**
- Loudness (20%)
- True Peak (25%)
- Dinâmica (15%)
- Estéreo (10%)
- Frequências (20%)
- Métricas técnicas gerais (10%)

---

### Por Que Score Pode Ser Baixo Sem "Erro Grave"

**O score reflete aderência técnica ao padrão do gênero, NÃO qualidade artística.**

**Exemplo real:**  
Música com LUFS -21.5 (alvo -8.3) terá score reduzido, mas pode ser escolha artística intencional para som mais dinâmico.

---

### Faixas de Interpretação

| Score | Interpretação |
|-------|---------------|
| **90-100** | Excelente aderência técnica ao gênero |
| **75-89** | Boa qualidade, pequenos ajustes recomendados |
| **60-74** | Qualidade aceitável, ajustes necessários |
| **40-59** | Desvios significativos, correções prioritárias |
| **0-39** | Múltiplos problemas técnicos, revisão completa |

**⚠️ Importante:**
- Score alto ≠ sucesso artístico garantido
- Score baixo ≠ música ruim
- Use como guia técnico, não julgamento final

---

### Como Interpretar a Tabela

**Cada linha mostra:**

**Exemplo:**
```
Sub: -12.5 dB (alvo: -10.0 dB) → -25% → 🔴 Crítico
```

**Interpretação:** Seu sub está 25% mais fraco que o padrão do gênero.

**Status:**
- 🟢 **OK (Verde):** Banda dentro da tolerância técnica do gênero
- 🟡 **Atenção (Amarelo):** Desvio moderado + recomenda ajuste
- 🔴 **Crítico (Vermelho):** Desvio grande, correção necessária

---

### Quando NÃO Seguir a Tabela

**NÃO ajuste quando:**
- Status é verde (OK)
- Desvio é intencional para estética artística
- Ajuste conflita com visão criativa
- Som está bom no seu sistema E em referências

**Regra de ouro:** Se soa bem auditivamente E tecnicamente próximo, confie no ouvido mesmo com desvio moderado.

---

## 7. COMO SEGUIR AS SUGESTÕES INTELIGENTES

### Como as Sugestões São Geradas

**Sistema analisa automaticamente:**
1. Desvios técnicos (compara métricas com alvos)
2. Severidade (classifica por impacto)
3. Priorização (ordena por dependência técnica)
4. Contextualização (adapta ao gênero)

---

### Relação Direta com Métricas

**Cada sugestão está vinculada a uma métrica específica.**

**Exemplo de sugestão:**
```
🔴 Loudness muito baixo
Sua música: -21.5 LUFS
Alvo: -8.3 LUFS
Diferença: -158.8%

Ação: Aumentar loudness final em aproximadamente 13.2 dB 
usando limitador/maximizer no master. Atenção: subir LUFS 
pode gerar clipping se não houver headroom suficiente.
```

---

### Como Aplicar na Prática

**1. Leia todas as sugestões antes de agir**  
Algumas correções dependem de outras.

**2. Siga a ordem de prioridade**  
Sugestões críticas (🔴) vêm primeiro.

**3. Aplique uma correção por vez**  
Ajustes simultâneos mascaram efeitos reais.

**4. Use ferramentas corretas:**
- **Loudness** → Limitador/Maximizer no master
- **True Peak** → Limiter com True Peak Detection + oversampling 4x
- **Frequências** → EQ paramétrico
- **Dinâmica** → Compressor/Expander
- **Estéreo** → Imager/Width plugins

**5. Valide auditivamente**  
Escute em diferentes sistemas (fone, monitor, celular).

---

### Importância da Reanálise

**Ciclo ideal:**  
Análise → Correção → Reanálise → Validação → Finalização

**Após aplicar correções:**
1. Exporte nova versão (WAV/FLAC)
2. Faça upload na SoundyAI
3. Compare scores e métricas
4. Verifique se problemas foram resolvidos
5. Certifique-se de que não surgiram novos problemas

---

## 8. ANÁLISE DE REFERÊNCIA (FEATURE MAIS PODEROSA)

### O Que É

**Análise de Referência** permite comparar sua música com **qualquer outra faixa** (não apenas os alvos de gênero).

**Casos de uso:**
- Comparar com faixa específica de um artista
- Benchmarking com hit do mercado
- A/B test entre duas versões de master
- Reverse engineering de produção favorita

---

### Como Usar (Passo a Passo)

**1. Upload da sua música**  
Faça análise normal primeiro.

**2. Ative modo referência**  
Na tela de resultados, clique em **"Comparar com Referência"**.

**3. Upload da faixa referência**  
Escolha arquivo WAV/FLAC/MP3 da música que quer usar como comparação.

**4. Sistema analisa referência**  
SoundyAI extrai métricas da faixa referência.

**5. Comparação lado a lado**  
Tabela mostra: sua música vs referência específica.

---

### Estratégias de Uso

#### Estratégia 1: Benchmarking Competitivo

**Objetivo:** Entender como faixas de sucesso do seu gênero são produzidas.

**Passo a passo:**
1. Escolha 2-3 hits recentes do seu subgênero
2. Analise cada uma como referência
3. Anote padrões comuns (LUFS, DR, balanço de frequências)
4. Use como guia para sua produção

**Exemplo prático:**
```
Referência 1 (Hit A): -8.5 LUFS, DR 7, Sub -11 dB
Referência 2 (Hit B): -8.2 LUFS, DR 6, Sub -10 dB
Referência 3 (Hit C): -8.8 LUFS, DR 8, Sub -12 dB

Padrão identificado: LUFS ~-8.5, DR 6-8, Sub -10 a -12 dB
```

---

#### Estratégia 2: A/B Master Comparison

**Objetivo:** Validar se nova versão de master é superior.

**Passo a passo:**
1. Analise Master V1 (versão atual)
2. Faça ajustes na DAW
3. Exporte Master V2 (nova versão)
4. Use modo referência: V2 vs V1
5. Compare métricas e score

**Decisão:**
- Se V2 tem score maior E soa melhor → aprova
- Se V2 tem score maior MAS soa pior → rejeita (confiar no ouvido)

---

#### Estratégia 3: Reverse Engineering

**Objetivo:** Entender decisões técnicas de produções específicas.

**Passo a passo:**
1. Escolha faixa com som que você quer replicar
2. Analise como referência
3. Anote todas as métricas
4. Compare com sua produção atual
5. Identifique maiores diferenças
6. Aplique correções focadas nessas diferenças

---

#### Estratégia 4: Comparar Seções Equivalentes

**⚠️ CRÍTICO:** Sempre compare seções equivalentes (intro vs intro, drop vs drop).

**Exemplo ERRADO:**
```
Sua música: intro calma (-18 LUFS)
Referência: drop pesado (-7 LUFS)
Resultado: comparação sem sentido
```

**Exemplo CORRETO:**
```
Sua música: drop pesado (-9 LUFS)
Referência: drop pesado (-8 LUFS)
Resultado: comparação útil (sua música está 1 LUFS abaixo)
```

**Como fazer:**
1. Exporte trecho específico da sua música (ex: drop, refrão)
2. Exporte mesmo trecho da referência
3. Analise ambos
4. Compare métricas

---

### Quando Usar Modo Gênero vs Modo Referência

| Situação | Usar Modo |
|----------|-----------|
| Análise geral de aderência ao estilo | **Gênero** |
| Primeira análise de uma faixa | **Gênero** |
| Validar padrões técnicos gerais | **Gênero** |
| Comparar com faixa específica | **Referência** |
| Reverse engineering de produção | **Referência** |
| A/B test entre versões | **Referência** |
| Benchmarking competitivo | **Referência** |

---

## 9. COMO USAR O CHATBOT CONTEXTUAL

### O Que É

**Chatbot com IA** integrado à análise que entende o **contexto da sua música** (métricas, gênero, problemas identificados).

**Diferença vs chat genérico:**
- ChatGPT genérico: não sabe nada sobre sua análise
- Chatbot SoundyAI: conhece todas as métricas e sugestões

---

### Casos de Uso Práticos

#### 1. Esclarecer Sugestões

**Situação:** Sugestão técnica não está clara.

**Exemplo de pergunta:**
```
"Por que o sistema recomenda reduzir 2 dB em Low-Mid? 
Minha música é Progressive Trance."
```

**Resposta esperada:**
```
No Progressive Trance, excesso em Low-Mid (250-500 Hz) 
causa "lama" que prejudica clareza dos leads. Sua análise 
mostra +28% de energia nessa banda vs referência, 
resultando em som abafado. Reduzir 2 dB com EQ vai 
restaurar definição sem perder corpo.
```

---

#### 2. Pedir Ajuda Específica

**Situação:** Você não sabe como aplicar correção na sua DAW.

**Exemplo de pergunta:**
```
"Como ajustar True Peak no FL Studio? 
Uso Maximus no master."
```

**Resposta esperada:**
```
No Maximus:
1. Band 3 (Master) → Ceiling: -1.0 dB
2. Ative oversampling (botão HQ)
3. Ajuste Threshold até TP ≤ -1.0 dBTP
4. Use Youlean para monitorar True Peak
```

---

#### 3. Entender Desvios

**Situação:** Métrica diverge muito do alvo, mas você não sabe por quê.

**Exemplo de pergunta:**
```
"Meu LUFS está -16.5 mas o alvo é -8.3. 
Se eu subir 8 dB, não vai clipar?"
```

**Resposta esperada:**
```
Sim, subir 8 dB direto vai clipar. Fluxo correto:
1. Primeiro garanta TP ≤ -1.0 dBTP (limiter)
2. Depois aumente input do limiter gradualmente
3. Monitore LUFS e TP simultaneamente
4. Se TP estourar, reduza input e aumente ratio do limiter
```

---

#### 4. Validar Decisões Artísticas

**Situação:** Você fez escolha intencional que diverge do padrão.

**Exemplo de pergunta:**
```
"Meu Progressive tem DR 14 (alvo é 10). 
Quero manter mais dinâmica. Isso é problema?"
```

**Resposta esperada:**
```
Não é problema técnico. DR 14 é válido artisticamente. 
Pode perder punch em sistemas de PA, mas em streaming 
e fones terá mais respiração e naturalidade. 
Se a intenção é som orgânico, mantenha.
```

---

### Boas Práticas no Chatbot

**✅ Faça:**
- Seja específico nas perguntas
- Mencione gênero e DAW quando relevante
- Peça exemplos práticos de correção
- Use para entender "por quê" das sugestões

**❌ Evite:**
- Perguntas genéricas ("Como fazer música boa?")
- Pedir avaliação artística ("Minha música é boa?")
- Tópicos não relacionados à análise técnica

---

## 10. ORDEM DE CORREÇÃO (POR QUE IMPORTA)

### Por Que a Ordem Reduz Retrabalho?

**Seguir ordem técnica correta evita:**
- Corrigir problema A e criar problema B
- Refazer ajustes várias vezes
- Mascarar problemas reais

---

### Ordem Oficial de Correção

**1️⃣ True Peak (PRIMEIRO DE TUDO)**

**Por quê primeiro:**  
Se TP estiver alto/clipando, qualquer ajuste de ganho depois vai mascarar problemas e distorcer resultado.

**Meta:** TP ≤ -1.0 dBTP (seguro)

**Como fazer:**
1. Insira limiter no master
2. Ceiling/Out: **-1.0 dB**
3. Ative oversampling (reduz inter-sample peaks)
4. Ajuste gain/threshold até TP ≤ -1.0 dBTP
5. Reanálise

---

**2️⃣ Loudness (LUFS)**

**Por quê agora:**  
Volume médio impacta percepção de dinâmica e espectro. Estabilizar LUFS cedo garante que ajustes seguintes sejam consistentes.

**Meta:** Depende do objetivo (ver seção 3)
- Análise técnica: ~-14 LUFS
- Pista/EDM: ~-8 a -10 LUFS
- Streaming: ~-14 LUFS

**Como fazer:**
1. Com limiter já configurado (ceiling -1 dBTP)
2. Use input/threshold do limiter para atingir LUFS desejado
3. Monitore com Youlean (Integrated, ITU, TP ON)
4. Reanálise (confirme: TP ainda ≤ -1 dBTP)

---

**3️⃣ Frequências (Balanceamento Espectral)**

**Por quê depois:**  
Qualquer ganho geral (LUFS) e controle de picos (TP) mudam percepção de graves/agudos. Ajustar EQ agora evita retrabalho.

**Meta:** Reduzir desvios das bandas em status "Crítico" ou "Atenção".

**Como fazer:**
1. Siga desvios apontados como **pistas, não ordens**
2. Comece com **±1 a 2 dB** por banda, Q moderado
3. Foque em **Sub e Grave primeiro** (kick/bass)
4. Depois **Médios** (corpo, presença)
5. Por fim **Agudos** (ar/sparkle)
6. Se banda está verde (OK), **não mexa**
7. Reanálise

---

**4️⃣ Dinâmica (DR, Crest Factor)**

**Por quê por último:**  
Ajustes de loudness afetam dinâmica. Refinar agora garante que compressão é intencional, não compensação.

**Meta:** Manter impacto sem "amassar" tudo.

**Como fazer:**
1. Se crest factor muito baixo → alivie limiter, rebalanceie kick/bass
2. Se dinâmica inconsistente → compressão suave em buses (não no master)
3. Evite "corrigir tudo no limiter"
4. Reanálise

---

**5️⃣ Refinamentos Finais (Estéreo, Width)**

**Por quê por último:**  
Ajustes anteriores podem ter afetado imagem estéreo. Refinar agora é o toque final.

**Meta:** Correlação entre 0.3 e 0.7.

**Como fazer:**
1. Se correlação > 0.8 → adicione width/stereo imaging
2. Se correlação < 0.2 → verifique problemas de fase, reduza width
3. Teste em mono (celular, rádio)
4. Reanálise final

---

### Resumo Visual

```
1. True Peak ≤ -1.0 dBTP
        ↓
2. LUFS ajustado ao target
        ↓
3. Frequências balanceadas
        ↓
4. Dinâmica refinada
        ↓
5. Estéreo otimizado
        ↓
✅ MASTER FINAL
```

---

## 11. BOAS PRÁTICAS E LIMITAÇÕES

### Boas Práticas

#### ✅ Sempre Analise Versão Final (ou Próxima Disso)

**Não analise:**
- Mixagens intermediárias
- Versões sem processamento de master
- Trechos isolados (a menos que seja intencional)

**Analise:**
- Pré-master limpo (para feedback de mix)
- Master final (para validação de lançamento)

---

#### ✅ Confira em Múltiplos Sistemas

**Antes de considerar análise definitiva:**
1. Fones de referência
2. Monitores de estúdio
3. Celular
4. Carro
5. Bluetooth speaker
6. Compare com faixas similares do gênero

---

#### ✅ Use Como Guia, Não Como Regra

**Música é subjetiva.** Se escolha artística intencional resulta em "score baixo", isso não invalida a escolha.

**Exemplo:**  
Faixa ambient com LUFS -25 (muito baixo) pode ser exatamente o que você quer artisticamente.

---

### Limitações da Ferramenta

#### ❌ Não Analisa Intenção Artística

SoundyAI não sabe se desvio técnico é intencional ou acidental. Ela apenas reporta o desvio.

---

#### ❌ Não Substitui Experiência Humana

**Métricas não capturam:**
- Feeling e groove
- Impacto emocional
- Coerência artística
- Contexto cultural/estilístico

---

#### ❌ Métricas Dependem do Contexto do Gênero

Score baixo em Funk pode ser score alto em Ambient. Sempre considere gênero selecionado.

---

#### ❌ Foco em Gêneros Eletrônicos/Urbanos

Análise otimizada para:
- Funk, EDM, Trance, Eletrônico

**Pode não ser ideal para:**
- Jazz acústico
- Música clássica
- Folk
- Rock orgânico

---

## 12. CHECKLIST FINAL RÁPIDO

### ✅ Pré-Upload

- [ ] Arquivo no formato correto (WAV/FLAC preferencial)
- [ ] Versão representativa (não trecho aleatório)
- [ ] Gênero de referência selecionado corretamente

### ✅ Análise

- [ ] Score geral anotado (baseline)
- [ ] Métricas críticas identificadas (vermelho)
- [ ] Tabela comparativa revisada
- [ ] Sugestões lidas completamente

### ✅ Correções

- [ ] True Peak corrigido primeiro (≤ -1.0 dBTP)
- [ ] LUFS ajustado ao target
- [ ] Frequências balanceadas (foco em críticos)
- [ ] Dinâmica refinada
- [ ] Estéreo otimizado

### ✅ Validação

- [ ] Reanálise feita após correções
- [ ] Score melhorou
- [ ] Nenhum novo problema crítico surgiu
- [ ] Teste auditivo em múltiplos sistemas
- [ ] Comparação com referência do gênero

### ✅ Finalização

- [ ] Export com settings corretos (taxa de amostragem, bit depth)
- [ ] Dither aplicado (se reduzindo bit depth)
- [ ] Backup da versão final
- [ ] Documentação (relatório PDF, anotações)

---

## 13. PROBLEMAS COMUNS & SOLUÇÕES

### 🔴 Problema 1: True Peak Passa de -1.0 dBTP

**Sintoma:** Limiter configurado, mas TP ainda estoura.

**Soluções:**
1. Ative **True Peak Detection** no limiter
2. Ative **oversampling 4x** (ou maior)
3. Reduza input do limiter em 0.5-1 dB
4. Use ceiling de **-1.5 dBTP** (margem extra)
5. Verifique se não há plugins após limiter gerando picos

---

### 🔴 Problema 2: Atingir -14 LUFS Mata o Punch

**Sintoma:** Ao atingir target LUFS, música perde impacto.

**Soluções:**
1. Reorganize ganho por buses (não só no master)
2. Use compressão paralela em drums
3. Adicione clipper leve em transientes (kick/snare)
4. Revise sidechain kick↔bass
5. Considere se -14 LUFS é target correto (talvez -10 seja melhor para seu gênero)

---

### 🔴 Problema 3: Grave Some ao Subir LUFS

**Sintoma:** Aumentar loudness reduz percepção de sub/grave.

**Soluções:**
1. Verifique sidechain kick↔bass (release muito longo?)
2. Aumente release do limiter (evita "comer" sub)
3. Use multiband compression (controle sub separadamente)
4. Boost leve em sub antes do limiter (+1 dB em 40-60 Hz)

---

### 🔴 Problema 4: Agudos Ásperos

**Sintoma:** High-Mid ou Brilho com desvio positivo, som sibilante.

**Soluções:**
1. Trate na fonte (de-esser em vocais, redução em hi-hats)
2. EQ: corte 1-2 dB em 6-8 kHz (sibilância)
3. EQ: atenue 1 dB em 12-15 kHz (ar excessivo)
4. Não resolva apenas no master, volte à mix

---

### 🔴 Problema 5: Score Varia Muito Entre Análises

**Sintoma:** Mesma música, scores diferentes.

**Causas possíveis:**
1. Analisando trechos diferentes (intro vs drop)
2. Exportando com settings diferentes
3. Aplicando processamento extra sem perceber

**Soluções:**
1. Use música inteira (ou trecho representativo consistente)
2. Confira configurações de export (taxa amostragem, bit depth)
3. Desative plugins de monitoring na exportação

---

### 🔴 Problema 6: Comparação com Referência Não Faz Sentido

**Sintoma:** Desvios gigantes mesmo em faixas similares.

**Causa provável:** Comparando seções diferentes (intro vs drop).

**Solução:**
1. Exporte trecho específico (ex: drop, refrão)
2. Exporte mesmo trecho da referência
3. Analise ambos
4. Compare métricas

**Regra:** Sempre compare seções equivalentes.

---

## 14. CHECKLIST DE VALIDAÇÃO INTERNA

### ✅ Conferi Alinhamento com Documento Oficial

- [ ] **LUFS:** Citado padrão ITU-R BS.1770-4
- [ ] **Alvos por gênero:** Exemplos corretos (Funk -8.3, Streaming -14)
- [ ] **True Peak:** Definido como dBTP, oversampling 4x, alvo ≤ -1.0 dBTP
- [ ] **DR:** Usado como métrica principal de dinâmica (não LRA)
- [ ] **Frequências:** 6 bandas exatas do documento oficial
- [ ] **Tolerâncias:** Citadas corretamente (Sub/Grave ±3 dB, etc.)
- [ ] **Ordem de correção:** TP → LUFS → Freq → Dinâmica → Estéreo
- [ ] **Score:** Sempre repetido "aderência técnica, não julgamento artístico"
- [ ] **Linguagem:** PT-BR, direto, didático, sem promessas exageradas
- [ ] **Tom:** Manual oficial, não promocional
- [ ] **Sem LRA:** Não usado como métrica principal (DR é oficial)
- [ ] **Não dogmatiza -14 LUFS:** Explicado contexto streaming vs pista
- [ ] **Modo Referência:** Seção dedicada com estratégias
- [ ] **Chatbot:** Seção explicando uso contextual
- [ ] **Fluxo SoundyAI:** Alinhado ao documento (upload → gênero → análise → score → tabela → sugestões → reanálise)
- [ ] **Nenhuma feature inventada:** Só o que existe no Documento Oficial
- [ ] **Micro alertas:** Incluídos (comparar seções equivalentes, etc.)
- [ ] **True Peak vs Peak:** Não confundidos (Peak dBFS ≠ True Peak dBTP)
- [ ] **Ferramentas genéricas:** Não recomendei medidores específicos errados

---

## 📞 SUPORTE E FEEDBACK

**Dúvidas técnicas:** Use o chatbot integrado à análise.

**Feedback sobre métricas:** Entre em contato pelo suporte da plataforma.

**O que reportar:**
- Arquivo analisado (se possível, compartilhe)
- Gênero selecionado
- Métrica específica com problema
- Valor esperado vs reportado
- Contexto adicional

---

**Documento criado por:** Equipe SoundyAI  
**Revisão técnica:** Engenharia de Áudio + Redação Técnica  
**Alinhamento:** Documento Técnico Oficial v1.0 (04-05/01/2026)  
**Licença:** Uso exclusivo para usuários SoundyAI

---

## 📚 GLOSSÁRIO TÉCNICO

**LUFS (Loudness Units relative to Full Scale):**  
Unidade de medida de volume percebido, padrão ITU-R BS.1770-4.

**dBTP (Decibels True Peak):**  
Pico absoluto do sinal após oversampling, detectando picos inter-sample.

**DR (Dynamic Range):**  
Diferença em dB entre trechos mais altos e mais baixos.

**RMS (Root Mean Square):**  
Valor médio quadrático do sinal, representa energia média.

**Crest Factor:**  
Relação entre pico e RMS, indica headroom para transientes.

**Clipping:**  
Distorção digital causada por sinal excedendo 0 dBFS.

**Headroom:**  
Espaço entre nível atual e pico máximo (0 dBFS).

**Inter-sample Peak:**  
Pico que ocorre entre amostras digitais, detectado por oversampling.

**DAW (Digital Audio Workstation):**  
Software de produção musical (Ableton, FL Studio, Logic, etc.).

**Oversampling:**  
Técnica que aumenta taxa de amostragem temporariamente para detectar picos inter-sample.

---

**FIM DO GUIA TÉCNICO**
