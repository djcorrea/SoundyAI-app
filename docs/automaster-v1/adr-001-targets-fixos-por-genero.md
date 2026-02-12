# ADR-001: Targets Fixos por Gênero

**Status:** ✅ Aceito  
**Data:** 09 de fevereiro de 2026  
**Decisores:** CTO, Audio Engineer, Product Manager  
**Contexto:** Definir como o AutoMaster determina valores-alvo (LUFS, DR, bandas espectrais)

---

## Contexto e Problema

O AutoMaster precisa saber **para onde** processar o áudio (targets).  
Existem 3 abordagens possíveis:

### Opção A: Targets Universais
Um único conjunto de targets para todos os gêneros.  
Exemplo: -11 LUFS, -0.3 dBTP, DR 8 dB para TUDO.

**Pros:**
- Simples de implementar
- Consistente e previsível

**Contras:**
- Ignora diferenças culturais entre gêneros
- Funk soaria fraco, clássica soaria esmagada
- Não compete com padrões da indústria

### Opção B: Targets Adaptativos (ML)
Treinar modelo de ML para detectar gênero e ajustar targets automaticamente.

**Pros:**
- Usuário não precisa escolher gênero
- Pode inferir sub-gêneros (ex: funk carioca vs paulista)

**Contras:**
- Precisa dataset grande (1000+ tracks anotadas)
- Custo adicional por inferência
- Risco de erro (misclassificação = master errado)
- Opacidade (usuário não sabe por que ficou assim)

### Opção C: Targets Fixos por Gênero (escolha manual)
Usuário escolhe gênero (funk, rock, eletrônica, etc.).  
Sistema carrega targets calibrados empiricamente para aquele gênero.

**Pros:**
- Targets baseados em análise de tracks profissionais reais
- Transparência total (usuário sabe o que escolheu)
- Consistência: mesmo gênero = mesmo resultado
- Reusa sistema de targets já existente no Analisador

**Contras:**
- Usuário precisa conhecer o gênero da sua música
- Não funciona para gêneros híbridos (ex: rock-eletrônico)

---

## Decisão

**Escolhemos Opção C: Targets Fixos por Gênero.**

### Justificativa

1. **Confiabilidade:** Targets baseados em 10+ faixas reais analisadas por gênero
2. **Consistência:** Mesma entrada + mesmo gênero = mesmo resultado (testável)
3. **Transparência:** Usuário sabe exatamente o que está acontecendo
4. **Reuso:** 90% dos targets do Analisador podem ser reutilizados
5. **Custo zero de inferência:** Sem ML, sem custo adicional
6. **Viabilidade de V1:** Implementável em 2-3 meses

### Implementação

- **Fonte de verdade:** Arquivos JSON em `work/refs/out/<genre>.json`
- **Gêneros iniciais:** funk_mandela, eletronica, rock, hip_hop, reggaeton, pop, sertanejo, classica
- **Expansão futura:** Adicionar gêneros conforme demanda (dados + calibração)

**Exemplo de target:**
```json
{
  "funk_mandela": {
    "version": "v2_hybrid_safe",
    "num_tracks": 10,
    "lufs_target": -9.2,
    "true_peak_target": -0.5,
    "dr_target": 9,
    "bands": {
      "sub": { "target_db": -22.75, "tol_db": 6 },
      "low_bass": { "target_db": -23.5, "tol_db": 5.5 }
    }
  }
}
```

---

## Consequências

### Positivas ✅
- Qualidade previsível e auditável
- Fácil de testar (replay attack: mesmo input = mesmo output)
- Fácil de debugar (logs mostram gênero escolhido)
- Usuário tem controle (pode escolher gênero diferente se não gostar)

### Negativas ❌
- Usuários leigos podem não saber escolher gênero (mitigação: sugestão baseada em análise)
- Gêneros híbridos não têm target perfeito (mitigação: sugerir gênero dominante)
- Trabalho manual para calibrar cada novo gênero (mitigação: priorizar top 10 gêneros)

### Neutras 🟡
- Precisa manter JSONs de targets sincronizados entre Analisador e AutoMaster

---

## Alternativas Consideradas

### ML para Auto-Detecção de Gênero (V2+)
Pode ser adicionado no futuro como **helper**, mas targets continuam fixos.  
Exemplo: ML sugere "funk_mandela", usuário confirma ou escolhe outro.

### Modo "Custom" com Sliders (V3+)
Permitir usuário ajustar targets manualmente (ex: "quero -8 LUFS").  
**Decisão:** Não para V1 (complexidade de UX e suporte).

---

**Status:** Implementar em Fase 5 do roadmap  
**Review:** Após 6 meses de uso, avaliar se ML vale a pena
