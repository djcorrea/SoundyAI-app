# DOCUMENTO TÉCNICO OFICIAL - SoundyAI

**Versão:** 1.0  
**Última atualização:** 04 de janeiro de 2026  
**Público-alvo:** Produtores musicais, DJs e engenheiros de áudio

---

## 1. INTRODUÇÃO - O QUE É A SOUNDYAI

A SoundyAI é uma plataforma web de análise técnica de áudio baseada em inteligência artificial e métricas profissionais de engenharia de som.

### Propósito

Fornecer análises técnicas precisas e objetivas de mixagem e masterização, comparando seu áudio com referências reais de mercado do gênero musical escolhido.

### O problema que resolve

Produtores e DJs frequentemente enfrentam dificuldades para avaliar objetivamente a qualidade técnica de suas produções. Questões como:

- Meu áudio está alto o suficiente?
- O grave está balanceado corretamente para o estilo?
- Estou tendo clipping ou distorção digital?
- Como minha música se compara com referências profissionais?

A SoundyAI responde essas perguntas com dados técnicos mensuráveis e comparações diretas.

### Diferenciais

- Análise específica por gênero musical (Funk, EDM, Trance, etc.)
- **Análise por Referência:** Compare sua música diretamente com a faixa de qualquer artista
- Comparação com padrões reais de mercado, não valores genéricos
- Métricas técnicas profissionais (LUFS ITU-R BS.1770-4, True Peak com oversampling 4x, Dynamic Range)
- Sugestões contextualizadas ao gênero escolhido
- Plano de correção passo a passo com priorização
- Chatbot inteligente com assistente virtual de áudio
- Sistema de IA para dúvidas técnicas específicas

### IMPORTANTE

A SoundyAI é uma ferramenta de análise técnica. Ela não substitui o ouvido humano nem a experiência artística. Música é arte, e cada produtor pode buscar características sonoras diferentes. Use as métricas como referência técnica, não como regra absoluta.

---

## 2. PARA QUEM A SOUNDYAI FOI CRIADA

### Perfil de usuário

**DJs e Produtores Musicais**  
Profissionais ou amadores que produzem faixas e precisam de feedback técnico objetivo sobre qualidade de mixagem e masterização.

**Engenheiros de Áudio**  
Profissionais que trabalham com mixagem/masterização e desejam validar tecnicamente seus trabalhos antes da entrega final.

### Estilos focados

A plataforma possui análise especializada para estilos de música eletrônica e urbana:

- Funk (Mandela, Bruxaria, BH)
- EDM (Electronic Dance Music)
- Progressive Trance
- Música eletrônica em geral

Cada estilo possui targets (alvos) de referência específicos, baseados em análises de faixas profissionais reais do mercado.

---

## 3. FLUXO CORRETO DE USO (ORDEM IDEAL)

### Por que a ordem importa?

Seguir o fluxo correto evita retrabalho e garante que você interprete os resultados adequadamente. Aplicar correções na ordem errada pode mascarar outros problemas ou criar novos.

### Passo 1: Upload do áudio

1. Clique no botão "Análise de áudio" no menu lateral
2. Leia o modal de boas-vindas (opcional, mas recomendado)
3. Na tela de upload, arraste seu arquivo ou clique em "Escolher Arquivo"
4. Formatos suportados: WAV, FLAC, MP3 (máximo 150MB)
5. **Recomendação:** Prefira WAV ou FLAC para maior precisão

**Por que essa ordem:** Começar com o formato correto garante que a análise seja precisa desde o início.

### Passo 2: Seleção do estilo musical

Antes do upload, você deve escolher o gênero de referência no dropdown "Gênero de Referência".

Opções disponíveis:
- Progressive Trance
- Funk Mandela
- Funk Bruxaria
- Funk BH
- EDM
- Eletrônico

**Por que essa ordem:** O gênero define os alvos (targets) de comparação. Escolher o gênero errado resultará em sugestões inadequadas.

### Passo 3: Aguardar análise

O sistema processa o áudio em múltiplas etapas:
1. Upload para servidor
2. Análise de métricas principais (LUFS, True Peak, Dinâmica)
3. Análise de frequências (Sub, Grave, Médios, Agudos)
4. Comparação com referência do gênero
5. Geração de sugestões inteligentes

Tempo médio: 30 segundos a 2 minutos (depende do tamanho do arquivo e da conexão).

**Por que essa ordem:** Cada etapa depende da anterior. Interromper o processo pode resultar em análise incompleta.

### Passo 4: Interpretação da tela de resultados

Após a análise, você verá:

**Score Final (0-100)**  
Métrica geral de qualidade técnica. Score baixo não significa "música ruim", mas sim que há divergências técnicas em relação ao padrão do gênero.

**Métricas Principais**  
Valores técnicos individuais: Loudness, True Peak, Dinâmica, Estéreo.

**Análise de Frequências**  
Distribuição de energia em 6 bandas espectrais.

**Tabela Comparativa**  
Comparação direta entre seu áudio e a referência do gênero, mostrando diferença percentual e severidade (OK, Atenção, Crítico).

**Sugestões Inteligentes**  
Lista de ajustes recomendados com prioridade e explicação.

**Por que essa ordem:** Ler o score primeiro dá uma visão geral, depois as métricas específicas revelam onde estão os problemas, e as sugestões indicam como corrigir.

### Passo 5: Leitura da tabela comparativa

A tabela mostra:
- **Valor:** Sua métrica atual
- **Alvo:** Valor de referência do gênero
- **Diferença (%):** Percentual de desvio
- **Status:** Severidade visual (cor verde/amarela/vermelha)

**Interpretação de cores:**
- **Verde (OK):** Dentro da tolerância
- **Amarelo (Atenção):** Pequeno desvio, ajuste recomendado
- **Vermelho (Crítico):** Desvio grande, correção necessária

**Por que essa ordem:** A tabela contextualiza os números. Sem essa comparação, um valor isolado pode ser mal interpretado.

### Passo 6: Aplicação das sugestões

As sugestões são geradas automaticamente e priorizadas. Siga a ordem apresentada:

1. **Correções críticas primeiro** (True Peak > 0 dBTP, clipping digital)
2. **Ajustes de loudness** (LUFS muito baixo ou alto)
3. **Balanceamento de frequências** (excesso de grave, falta de brilho, etc.)
4. **Refinamentos finais** (dinâmica, estéreo)

**Por que essa ordem:** Corrigir clipping antes de ajustar loudness evita distorção adicional. Ajustar frequências após loudness garante que o balanceamento tonal seja mantido no volume final.

### Passo 7: Reanálise

Após aplicar correções na sua DAW:
1. Exporte novamente (WAV ou FLAC)
2. Faça upload na SoundyAI
3. Compare o novo score e métricas com a análise anterior

**Por que essa ordem:** A reanálise valida que suas correções foram efetivas e não criaram novos problemas.

### Resumo do fluxo ideal

```
Upload → Seleção de Gênero → Análise → Score/Métricas → Tabela Comparativa → 
Sugestões → Aplicar Correções → Reanálise
```

---

## 3.1. ANÁLISE POR REFERÊNCIA - COMPARAÇÃO DIRETA COM ARTISTAS

### O que é

A Análise por Referência é uma funcionalidade **exclusiva PRO** que permite comparar sua música diretamente com a faixa de **qualquer artista profissional** que você escolher.

Ao invés de comparar com padrões genéricos de gênero, você compara A/B (lado a lado) com uma música específica que serve de inspiração ou meta técnica.

### Como funciona

**Processo:**

1. Ao abrir o modal de análise, escolha o modo "Por Música de Referência"
2. Faça upload da **sua música** (primeira faixa)
3. Faça upload da **música de referência** do artista (segunda faixa)
4. O sistema analisa ambas as faixas tecnicamente
5. Gera uma tabela comparativa lado a lado
6. Exibe diferenças percentuais entre as duas músicas
7. Cria sugestões específicas para aproximar sua música da referência

**Exemplo prático:**

Você produziu um Progressive Trance e quer que soe como "Adagio for Strings" do Tiësto. Ao invés de comparar com padrões genéricos de Trance, você:

1. Upload da sua track
2. Upload de "Adagio for Strings"
3. Sistema compara tecnicamente:
   - LUFS: Você -10.5, Referência -8.2 → Diferença -27.9%
   - Grave: Você -15 dB, Referência -11 dB → Diferença -36.4%
   - Agudos: Você -20 dB, Referência -18 dB → Diferença -11.1%

### Vantagens da Análise por Referência

**Precisão técnica:**  
Você não compara com "média de mercado", mas sim com uma música real e específica.

**Direcionamento artístico:**  
Se você quer soar como um artista específico, essa é a forma mais direta.

**Aprendizado avançado:**  
Entenda exatamente o que diferencia sua produção de uma referência profissional.

**Versatilidade:**  
Funciona com qualquer estilo, qualquer artista, qualquer época.

### Quando usar Análise por Referência

**Use quando:**
- Você tem uma música específica como meta técnica
- Quer entender as diferenças técnicas entre sua produção e uma referência
- Está buscando um som específico de um artista
- Precisa validar se sua mixagem está no mesmo nível técnico

**NÃO use quando:**
- Você só quer validar se está dentro dos padrões gerais do gênero (use modo Gênero)
- A referência escolhida não é masterizada profissionalmente
- Você quer comparar com múltiplas referências simultaneamente

### Diferença entre Modo Gênero e Modo Referência

**Modo Gênero (padrão):**
- Compara com **média estatística** de centenas de faixas profissionais
- Alvo: Padrão de mercado do estilo
- Ideal para: Validação técnica geral

**Modo Referência (PRO):**
- Compara com **uma música específica** escolhida por você
- Alvo: Faixa exata que você quer imitar tecnicamente
- Ideal para: Aprendizado direcionado e metas específicas

### Interpretação dos resultados

A tabela comparativa mostra:

**Coluna 1:** Sua música  
**Coluna 2:** Música de referência  
**Coluna 3:** Diferença percentual  
**Coluna 4:** Status (OK/Atenção/Crítico)

**Exemplo:**
```
┌──────────────────┬──────────┬────────────┬────────────┬──────────┐
│ Métrica          │ Sua      │ Referência │ Diferença  │ Status   │
├──────────────────┼──────────┼────────────┼────────────┼──────────┤
│ Loudness (LUFS)  │ -12.5    │ -8.3       │ -50.6%     │ Crítico  │
│ True Peak (dBTP) │ -0.8     │ -1.2       │ +50.0%     │ Atenção  │
│ Sub (dB)         │ -18.0    │ -10.0      │ -80.0%     │ Crítico  │
└──────────────────┴──────────┴────────────┴────────────┴──────────┘
```

**Leitura:** Seu sub está 80% mais fraco que a referência. Ação: aumentar graves.

### Limitações importantes

1. **Qualidade da referência:** Se a faixa de referência for mal masterizada, a comparação será inválida
2. **Contexto artístico:** Diferenças podem ser escolhas artísticas intencionais da referência
3. **Subjetividade:** Copiar tecnicamente não garante impacto artístico igual

---

## 4. ENTENDENDO O SCORE FINAL

### O que o score representa

O score final (0-100) é uma métrica agregada que combina:

- Loudness (peso: 20%)
- True Peak (peso: 25%)
- Dinâmica (peso: 15%)
- Estéreo (peso: 10%)
- Frequências (peso: 20%)
- Métricas técnicas gerais (peso: 10%)

### Por que o score pode ser baixo sem "erro grave"

O score reflete **aderência técnica ao padrão do gênero**, não qualidade artística.

**Exemplo real:**  
Uma música com LUFS -21.5 (quando o alvo é -8.3) terá score reduzido, mas isso não significa que seja "ruim". Pode ser uma escolha artística intencional para som mais dinâmico.

### Como o score deve ser interpretado

- **90-100:** Excelente aderência técnica ao gênero
- **75-89:** Boa qualidade, pequenos ajustes recomendados
- **60-74:** Qualidade aceitável, ajustes necessários
- **40-59:** Desvios significativos, correções prioritárias
- **0-39:** Múltiplos problemas técnicos, revisão completa necessária

**Importante:** Score alto não garante sucesso artístico. Score baixo não significa música ruim. Use como guia técnico, não como julgamento final.

### Mensagem científica abaixo do score

Logo abaixo do score final, você verá uma mensagem informativa:

> "As métricas e sugestões são baseadas em ciência de áudio e referências reais do gênero. Porém, música é arte: cada produtor pode querer características diferentes. Use estas dicas como um guia de referência, não como uma regra absoluta."

Essa mensagem existe para lembrar que:

1. **Os dados são científicos:** Baseados em ITU-R BS.1770-4, oversampling 4x, análise espectral real
2. **Mas música é subjetiva:** Você pode intencionalmente desviar dos padrões
3. **Use como guia:** Não como limitação criativa

Essa mensagem é especialmente importante para evitar que produtores sigam cegamente as métricas sem considerar sua visão artística.

---

## 5. MÉTRICAS PRINCIPAIS (EXPLICAÇÃO TÉCNICA)

### Loudness (LUFS - Loudness Units relative to Full Scale)

**O que é:**  
Métrica padronizada de percepção de volume sonoro, medida conforme ITU-R BS.1770-4.

**Por que importa:**  
Define o volume percebido da música. Streaming platforms (Spotify, YouTube) normalizam áudios para um LUFS específico. Se sua música estiver muito alta ou baixa, será ajustada automaticamente, podendo perder impacto.

**Alvos típicos:**
- Funk/EDM: -8.3 LUFS (alto impacto de pista)
- Streaming (Spotify): -14 LUFS
- Progressive Trance: varia conforme subgênero

**Impacto na pista:**  
LUFS muito baixo resulta em música sem presença. LUFS muito alto pode gerar distorção e cansaço auditivo.

### True Peak (dBTP - Decibels True Peak)

**O que é:**  
Pico absoluto do sinal de áudio após oversampling 4x, detectando picos inter-sample (que ocorrem entre amostras digitais).

**Por que importa:**  
Previne clipping digital durante conversão D/A (digital para analógico) em sistemas de reprodução. True Peak acima de 0 dBTP pode causar distorção em alto-falantes e compressores de streaming.

**Alvo recomendado:**  
Manter abaixo de -1.0 dBTP (idealmente -1.5 dBTP para margem de segurança).

**Impacto na pista:**  
True Peak estourado (> 0 dBTP) gera distorção digital audível como "cliques" ou "crunches" desagradáveis.

### Dinâmica (DR - Dynamic Range)

**O que é:**  
Diferença entre os trechos mais altos e mais baixos da música, medida em dB.

**Por que importa:**  
Define o "espaço para respirar" da música. Alta dinâmica = sons mais naturais. Baixa dinâmica = som mais constante e "agressivo".

**Alvos típicos:**
- Funk/EDM de pista: 6-10 DR (mais comprimido)
- Trance melódico: 8-12 DR
- Música dinâmica: > 12 DR

**Impacto na pista:**  
DR muito baixo (< 6) resulta em som cansativo e "tijolaço". DR muito alto pode parecer fraco em sistemas de PA.

### Crest Factor

**O que é:**  
Relação entre o pico do sinal e o RMS (Root Mean Square - valor médio), medida em dB.

**Por que importa:**  
Indica o quanto de "headroom" a música tem para transientes (ataques de bateria, drops). Crest Factor baixo indica compressão excessiva.

**Alvo típico:**  
8-12 dB para música eletrônica.

**Impacto na pista:**  
Crest Factor muito baixo torna a música sem punch. Muito alto pode resultar em volume percebido baixo.

### Estéreo (Correlação e Largura)

**O que é:**  
Mede a diferença entre canais Left e Right. Correlação de +1 = mono, 0 = estéreo descorrelacionado, -1 = anti-fase (problemático).

**Por que importa:**  
Define a sensação de "largura" e "espaço" da música. Correlação negativa pode causar cancelamento de fase em sistemas mono (ex: celulares, rádio).

**Alvo recomendado:**  
Correlação entre 0.3 e 0.7 (estéreo balanceado).

**Impacto na pista:**  
Correlação muito alta (> 0.8) = som mono, sem espacialidade. Correlação negativa = problemas em mono.

---

## 6. ANÁLISE DE FREQUÊNCIAS

### Bandas espectrais analisadas

A SoundyAI divide o espectro em 6 bandas:

1. **Sub (20-60 Hz):** Sub-grave, energia do kick
2. **Grave (60-250 Hz):** Grave fundamental, corpo do baixo
3. **Low-Mid (250-500 Hz):** Médio-grave, corpo de vocais e instrumentos
4. **Mid (500-2000 Hz):** Médios, presença e clareza
5. **High-Mid (2000-4000 Hz):** Médio-agudos, definição
6. **Brilho (4000-20000 Hz):** Agudos, ar e sparkle

### Como ler os valores

Cada banda mostra:
- **Valor atual (dB):** Energia média da banda em sua música
- **Alvo (dB):** Energia de referência para o gênero
- **Diferença (%):** Desvio em relação ao alvo

**Exemplo:**  
```
Sub: -12.5 dB (alvo: -10.0 dB) → -25% → Crítico
```

Isso significa: seu sub está 25% mais fraco que o padrão do gênero.

### O que significa "dentro do padrão"

Status "OK" (verde) indica que a banda está dentro da **tolerância técnica** do gênero. Isso não significa que seja perfeita, mas sim que está no range aceitável.

**Tolerâncias típicas:**
- Sub/Grave: ±3 dB (mais sensível)
- Médios: ±4 dB
- Agudos: ±5 dB (menos sensível)

### Quando mexer e quando NÃO mexer

**Quando ajustar:**
- Status "Crítico" (vermelho) → correção prioritária
- Status "Atenção" (amarelo) + feedback auditivo negativo

**Quando NÃO ajustar:**
- Status "OK" (verde) → deixar como está
- Desvios intencionais para estética artística
- Quando o ajuste conflita com a visão criativa

**Regra de ouro:** Se soa bem no seu sistema E nas referências do gênero, confie no ouvido mesmo com desvio técnico moderado.

---

## 7. COMPARAÇÃO COM REFERÊNCIA DE GÊNERO

### O que é a tabela comparativa

A tabela exibe lado a lado:
- **Sua música** (coluna "Valor")
- **Referência do gênero** (coluna "Alvo")
- **Diferença percentual** (coluna "Diferença")
- **Severidade visual** (coluna "Status")

### Como interpretar cada coluna

**Valor:**  
Sua métrica atual, calculada pela análise.

**Alvo:**  
Valor médio de referências profissionais do gênero, baseado em análises de faixas reais de mercado.

**Diferença (%):**  
`((Valor - Alvo) / Alvo) × 100`

Exemplo: LUFS -16.5 vs alvo -8.3 = -98.8% (muito mais baixo)

**Status (cor):**
- Verde: dentro da tolerância (0-15% de desvio)
- Amarelo: desvio moderado (15-30%)
- Vermelho: desvio grande (> 30%)

### Por que seguir referência NÃO é regra absoluta

**Contexto importa:**

- Referências são médias estatísticas, não leis físicas
- Subgêneros dentro do mesmo estilo podem ter características diferentes
- Escolhas artísticas intencionais são válidas
- Sistemas de reprodução variam (headphone, PA, streaming)

**Exemplo real:**  
Uma faixa de Progressive Trance com drop extremo pode ter LUFS mais alto no drop que a média do gênero. Isso é intencional e aceitável.

**Use a referência como guia, não como limite criativo.**

---

## 8. SUGESTÕES INTELIGENTES E PLANO DE CORREÇÃO

### Como as sugestões são geradas

O sistema analisa automaticamente:

1. **Desvios técnicos:** compara suas métricas com os alvos
2. **Severidade:** classifica problemas por impacto (crítico > atenção > ok)
3. **Priorização:** ordena correções por dependência técnica
4. **Contextualização:** adapta sugestões ao gênero escolhido

### Relação direta com as métricas

Cada sugestão está vinculada a uma métrica específica:

**Exemplo de sugestão:**
```
🔴 Loudness muito baixo
Sua música: -21.5 LUFS
Alvo: -8.3 LUFS
Diferença: -158.8%

Ação: Aumentar loudness final em aproximadamente 13.2 dB usando 
limitador/maximizer no master. Atenção: subir LUFS pode gerar 
clipping se não houver headroom suficiente.
```

### Como aplicar na prática

**1. Leia todas as sugestões antes de agir**  
Algumas correções dependem de outras.

**2. Siga a ordem de prioridade**  
Sugestões críticas (vermelho) vêm primeiro.

**3. Aplique uma correção por vez**  
Ajustes simultâneos podem mascarar o efeito real.

**4. Use as ferramentas corretas**
- Loudness → Limitador/Maximizer no master
- True Peak → Limiter com True Peak Detection
- Frequências → EQ paramétrico
- Dinâmica → Compressor/Expander
- Estéreo → Imager/Width plugins

**5. Valide auditivamente**  
Antes de exportar, escute em diferentes sistemas (fone, monitor, celular).

### Importância da reanálise

Após aplicar correções:

1. Exporte nova versão (WAV/FLAC)
2. Faça upload na SoundyAI
3. Compare scores e métricas
4. Verifique se os problemas foram resolvidos
5. Certifique-se de que não surgiram novos problemas

**Ciclo ideal:** Análise → Correção → Reanálise → Validação → Finalização

---

## 9. CHATBOT INTELIGENTE - SEU ASSISTENTE VIRTUAL DE ÁUDIO

### O que é

O Chatbot da SoundyAI é um **assistente virtual especializado** em engenharia de áudio, mixagem e masterização. Ele fica sempre disponível na tela principal e pode responder dúvidas técnicas, explicar conceitos e orientar sobre uso da plataforma.

### Como funciona

**Localização:**  
O chatbot fica posicionado no centro da tela, integrado ao design futurista da plataforma.

**Estados:**

1. **Welcome State (Estado Inicial):**
   - Título: "SoundyAI"
   - Subtítulo: "Seu engenheiro de áudio virtual"
   - Campo de input para primeira mensagem
   - Ícone do robô animado

2. **Active State (Durante conversa):**
   - Header com nome "SoundyAI"
   - Área de conversação com histórico de mensagens
   - Input de resposta na parte inferior
   - Indicador de digitação quando a IA está processando

### Funcionalidades do Chatbot

**1. Responder dúvidas técnicas:**
```
Você: "O que é LUFS?"
Bot: "LUFS (Loudness Units relative to Full Scale) é uma medida..."
```

**2. Explicar conceitos de áudio:**
```
Você: "Por que meu grave está muito alto?"
Bot: "Grave excessivo pode mascarar outras frequências..."
```

**3. Orientar sobre uso da plataforma:**
```
Você: "Como faço para comparar com uma referência?"
Bot: "Para usar o Modo Referência, clique em..."
```

**4. Interpretar resultados:**
```
Você: "Meu score está 65, é bom?"
Bot: "Score 65 indica qualidade aceitável, mas há ajustes..."
```

### Quando usar o Chatbot

**Use para:**
- Tirar dúvidas sobre métricas técnicas
- Entender o significado de termos técnicos
- Pedir orientação sobre como usar funcionalidades
- Obter explicações sobre resultados da análise
- Aprender conceitos de engenharia de áudio

**NÃO use para:**
- Análise técnica profunda (use "Pedir Ajuda à IA" na tela de resultados)
- Feedback específico sobre sua música (use análise + sugestões)
- Suporte técnico de bugs (use canal oficial de suporte)

### Diferença entre Chatbot e "Pedir Ajuda à IA"

**Chatbot (disponível para todos):**
- Assistente genérico de dúvidas
- Responde perguntas conceituais
- Não tem contexto da sua análise
- Educacional e informativo

**Pedir Ajuda à IA (PRO, na tela de resultados):**
- Analisa **especificamente sua música**
- Tem acesso a todas as métricas da sua análise
- Gera orientações personalizadas
- Foco em correção prática

### Exemplos de uso

**Exemplo 1 - Conceito técnico:**
```
Você: "O que é True Peak e por que importa?"

Bot: "True Peak é o pico absoluto do sinal de áudio após 
oversampling 4x. Ele detecta picos inter-sample que podem 
causar distorção digital durante conversão D/A. Manter True 
Peak abaixo de -1.0 dBTP previne clipping em sistemas de 
reprodução e compressores de streaming."
```

**Exemplo 2 - Como usar funcionalidade:**
```
Você: "Posso comparar minha música com a de outro artista?"

Bot: "Sim! Use o Modo Referência (exclusivo PRO). Ao abrir o 
modal de análise, selecione 'Por Música de Referência', depois 
faça upload da sua música e da música do artista. O sistema 
compara lado a lado e mostra as diferenças técnicas."
```

**Exemplo 3 - Interpretação de resultado:**
```
Você: "Meu LUFS está -21.5, é muito baixo?"

Bot: "Sim, -21.5 LUFS é significativamente baixo para música de 
pista. O padrão de Funk/EDM é cerca de -8.3 LUFS. Sua música 
terá volume percebido muito menor que referências profissionais. 
Recomendo aumentar loudness usando limitador no master."
```

### Limitações

1. **Sem contexto da análise:** O chatbot não sabe o resultado da sua análise (use "Pedir Ajuda à IA" para isso)
2. **Respostas genéricas:** Não adapta ao seu gênero específico sem você informar
3. **Educacional, não corretivo:** Ensina conceitos, mas não dá passo a passo personalizado

---

## 10. PEDIR AJUDA À IA - ANÁLISE PERSONALIZADA (PRO)

### O que é

Funcionalidade **exclusiva PRO** disponível na tela de resultados que gera uma análise personalizada e detalhada da sua música, com orientações específicas baseadas em todas as métricas técnicas detectadas.

### Diferença para o Chatbot

**Chatbot:**
- Disponível na tela principal
- Responde dúvidas gerais
- Não tem acesso às suas métricas
- Educacional

**Pedir Ajuda à IA:**
- Disponível apenas na tela de resultados
- Exclusivo para usuários PRO
- Tem acesso completo a todas as métricas da sua análise
- Gera feedback personalizado

### Como funciona

1. Após a análise ser concluída, aparece o botão **"Pedir Ajuda à IA"**
2. Ao clicar, a IA processa:
   - Todas as métricas técnicas (LUFS, True Peak, DR, bandas espectrais)
   - Score final e subscores
   - Gênero selecionado
   - Desvios em relação aos alvos
   - Severidade dos problemas detectados

3. Gera um relatório detalhado com:
   - **Diagnóstico geral:** Visão panorâmica da qualidade técnica
   - **Problemas prioritários:** Lista ordenada do mais crítico ao menos crítico
   - **Orientações específicas:** Como corrigir cada problema
   - **Ferramentas recomendadas:** Plugins/técnicas para cada correção
   - **Ordem de aplicação:** Sequência ideal de ajustes

### Exemplo de resposta

**Input:** Música analisada com LUFS -21.5, True Peak 0.5 dBTP, Grave -18 dB

**Output da IA:**

```
🔍 DIAGNÓSTICO GERAL
Sua música apresenta 3 problemas técnicos prioritários que 
estão impactando negativamente o score final (Score: 58/100).

🚨 PROBLEMAS CRÍTICOS (ordem de prioridade)

1️⃣ TRUE PEAK ESTOURADO (0.5 dBTP)
Problema: Clipping digital detectado. Picos acima de 0 dBTP 
causam distorção audível.
Ação: Aplicar limiter com True Peak Detection. Target: -1.0 dBTP.
Ferramentas: FabFilter Pro-L2, Waves L2, Ozone Maximizer.

2️⃣ LOUDNESS MUITO BAIXO (-21.5 LUFS)
Problema: Volume percebido 13 dB abaixo do padrão Funk (-8.3 LUFS).
Ação: Aumentar loudness após corrigir True Peak. Usar limitador 
com ganho de +13 dB aproximadamente.
Atenção: Corrigir True Peak ANTES, senão vai gerar mais clipping.

3️⃣ GRAVE MUITO FRACO (-18 dB)
Problema: Sub/Grave 80% mais fraco que referência (-10 dB).
Ação: Boost de +8 dB em 60-250 Hz com EQ paramétrico. 
Filtro shelf ou bell. Validar em subwoofer.

📋 ORDEM DE APLICAÇÃO
1. Corrigir True Peak (limiter com detection)
2. Ajustar Loudness (maximizer no master)
3. Reforçar Grave (EQ antes do limiter)
4. Reanalisar para validar

⏱️ Tempo estimado: 15-30 minutos
```

### Quando usar

**Use "Pedir Ajuda à IA" quando:**
- Você não sabe por onde começar as correções
- Há múltiplos problemas e você quer priorização
- Precisa de orientação técnica específica para sua música
- Quer entender a relação entre os problemas detectados

**NÃO use quando:**
- Você só quer tirar dúvidas conceituais (use Chatbot)
- Não tem plano PRO (funcionalidade bloqueada)
- Já sabe exatamente o que fazer

### Vantagens

1. **Contextualizado:** A IA sabe exatamente as métricas da sua música
2. **Priorizado:** Ordena problemas do mais crítico ao menos importante
3. **Didático:** Explica o "por quê" de cada problema
4. **Prático:** Indica ferramentas e técnicas concretas
5. **Sequencial:** Define ordem correta de aplicação

### Limitações

1. **Exclusivo PRO:** Planos Free/Plus não têm acesso
2. **Baseado em métricas:** Não avalia aspectos artísticos/criativos
3. **Sugestões genéricas:** Não considera setup específico da sua DAW
4. **Uma análise por vez:** Cada clique gera uma nova análise (pode variar ligeiramente)

---

## 11. PLANO DE CORREÇÃO (FUNCIONALIDADE PRO)

### O que é

Recurso exclusivo do plano PRO que organiza automaticamente todas as sugestões em um plano passo a passo estruturado, com priorização técnica e instruções detalhadas.

### Quando usar

- Quando houver múltiplas sugestões (> 5)
- Para seguir uma ordem técnica validada
- Para compartilhar com engenheiro de mix/master
- Para documentar o processo de correção

### Como ele complementa a análise técnica

O plano de correção agrupa sugestões por categoria:

1. **Problemas críticos:** True Peak, clipping, fase
2. **Loudness e dinâmica:** LUFS, DR, compressão
3. **Frequências:** Bandas espectrais, EQ
4. **Refinamentos:** Estéreo, crest factor

Cada item inclui:
- Diagnóstico técnico
- Ação recomendada
- Ferramentas sugeridas
- Valores target

---

## 12. RELATÓRIO EM PDF

### O que ele contém

O relatório PDF inclui:

- Informações da análise (data, arquivo, gênero)
- Score final e gráfico de evolução
- Todas as métricas principais
- Análise de frequências (gráfico de barras)
- Tabela comparativa completa
- Sugestões priorizadas
- Observações técnicas

### Quando usar

- Para documentação de projetos
- Para enviar ao engenheiro de mix/master
- Para comparar versões ao longo do tempo
- Para apresentação a clientes/labels

### Diferença entre análise visual e relatório

**Análise visual (na plataforma):**  
Interativa, permite explorar detalhes, atualiza em tempo real.

**Relatório PDF:**  
Estático, portátil, ideal para compartilhamento e arquivamento.

---

## 13. BOAS PRÁTICAS

### Analisar versões finais

Sempre analise a versão mais próxima possível do master final. Analisar uma versão intermediária pode resultar em sugestões desnecessárias.

### Evitar analisar pré-masters crus

Não analise mixagens antes da masterização. A SoundyAI compara com referências masterizadas profissionalmente.

### Conferir em mais de um sistema

Antes de considerar a análise como definitiva:

1. Escute em fones de referência
2. Teste em monitores de estúdio
3. Valide em sistemas "reais" (celular, carro, bluetooth)
4. Compare com faixas similares do gênero

### Usar como guia, não como regra

A SoundyAI fornece dados técnicos objetivos, mas música é subjetiva. Se uma escolha artística intencional resulta em "score baixo", isso não invalida a escolha.

**Exemplo:**  
Uma faixa ambient com LUFS -25 (muito baixo) pode ser exatamente o que você quer artisticamente.

---

## 14. LIMITAÇÕES DA FERRAMENTA

### Não analisa intenção artística

A SoundyAI não sabe se um desvio técnico é intencional ou acidental. Ela apenas reporta o desvio.

### Não substitui experiência humana

Métricas técnicas são importantes, mas não capturam:

- Feeling e groove
- Impacto emocional
- Coerência artística
- Contexto cultural/estilístico

### Métricas dependem do contexto do gênero

Um "score baixo" em Funk pode ser "score alto" em Ambient. Sempre considere o gênero selecionado.

### Limitações conhecidas

- Análise focada em gêneros eletrônicos/urbanos
- Referências baseadas em mercado brasileiro/internacional (pode não refletir nichos específicos)
- Não analisa aspectos subjetivos (emoção, storytelling, originalidade)

---

## 15. COMO FORNECER FEEDBACK

A SoundyAI evolui com feedback de usuários reais.

### O que observar

- Métricas que parecem incorretas
- Sugestões que não fazem sentido para o gênero
- Scores inconsistentes entre análises similares
- Bugs ou erros de interface

### O que reportar

Ao encontrar um problema, informe:

1. **Arquivo analisado** (se possível, compartilhe)
2. **Gênero selecionado**
3. **Métrica específica** (ex: "LUFS", "Sub")
4. **Valor esperado vs valor reportado**
5. **Contexto adicional** (ex: "Analisei a mesma música em outro software e deu X")

### Como isso ajuda a evoluir a plataforma

Feedback qualificado permite:

- Ajustar targets de referência por gênero
- Corrigir bugs de cálculo
- Melhorar sugestões contextualizadas
- Adicionar novos gêneros/estilos
- Refinar algoritmos de score

**Contato:** Use o chat da plataforma ou o suporte por e-mail.

---

## GLOSSÁRIO TÉCNICO

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
Espaço entre o nível atual do sinal e o pico máximo (0 dBFS).

**DAW (Digital Audio Workstation):**  
Software de produção musical (Ableton, FL Studio, Logic, etc.).

**Mix:**  
Processo de balancear volumes, pans e efeitos de múltiplas tracks.

**Master:**  
Processo final de preparação do áudio para distribuição (loudness, EQ final, limiter).

---

## CONCLUSÃO

A SoundyAI é uma ferramenta técnica para auxiliar produtores e engenheiros a validar objetivamente a qualidade de seus áudios. Use-a como complemento ao seu ouvido e experiência, não como substituta.

**Lembre-se:**  
- Música é arte, métricas são guias
- Score alto não garante sucesso artístico
- Score baixo não significa música ruim
- Contexto e intenção sempre importam

**Fluxo ideal:**  
Upload → Análise → Interpretação → Correção → Reanálise → Validação Auditiva

**Dúvidas?**  
Entre em contato pelo suporte da plataforma.

---

**Documento criado por:** Equipe SoundyAI  
**Revisão técnica:** Engenharia de Áudio  
**Licença:** Uso exclusivo para usuários SoundyAI
