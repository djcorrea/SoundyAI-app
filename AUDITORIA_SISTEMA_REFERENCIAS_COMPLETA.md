# 🔍 AUDITORIA COMPLETA DO SISTEMA DE REFERÊNCIAS DE GÊNEROS

**Data:** 14 de outubro de 2025  
**Objetivo:** Atualizar, expandir e padronizar o sistema de referências de gêneros musicais

---

## 📊 ESTADO ATUAL DO SISTEMA

### Estrutura de Arquivos
- **Pasta:** `public/refs/out/`
- **Arquivo principal:** `genres.json` (manifesto de gêneros)
- **Arquivos individuais:** `{genero}.json` para cada gênero

### Gêneros Existentes (8 total)
1. ✅ **trance** - Estrutura completa v2_hybrid_safe
2. ✅ **funk_mandela** - Estrutura completa v2_hybrid_safe
3. ✅ **funk_bruxaria** - Estrutura completa v2_hybrid_safe
4. ✅ **funk_automotivo** - Estrutura v2.0 completa
5. ❌ **eletronico** - A SER REMOVIDO
6. ✅ **eletrofunk** - Estrutura v1.0 (precisa atualização)
7. ⚠️ **funk_consciente** - Existente mas não listado (verificar)
8. ✅ **trap** - Estrutura v1.0 (precisa padronização)

### Formato Padrão Identificado

#### Estrutura v2_hybrid_safe (Mais Moderna)
```json
{
  "genero": {
    "version": "v2_hybrid_safe",
    "generated_at": "2025-08-31T14:58:44.917Z",
    "num_tracks": 10,
    "processing_mode": "fallback_safe",
    "hybrid_processing": {
      "original_metrics": {
        "lufs_integrated": -11.8,
        "true_peak_dbtp": -1.2,
        "dynamic_range": 7.5,
        "rms_db": -14.8,
        "stereo_correlation": 0.75
      },
      "spectral_bands": { ... }
    },
    "legacy_compatibility": {
      "lufs_target": -11.8,
      "true_peak_target": -1.2,
      "dr_target": 7.5,
      "stereo_target": 0.75,
      "tol_lufs": 2.5,
      "tol_true_peak": 3,
      "tol_dr": 3,
      "tol_stereo": 0.25,
      "bands": { ... }
    },
    "processing_info": { ... },
    "last_updated": "...",
    "cache_bust": 1756652324917
  }
}
```

### Como o Sistema Usa as Referências

1. **Carregamento:** `audio-analyzer-integration.js` função `loadReferenceData()`
   - Tenta carregar de `/public/refs/out/{genero}.json`
   - Fallback para referências embedded
   
2. **Uso no Score:** `enhanced-suggestion-engine.js`
   - Extrai métricas da análise
   - Calcula z-scores comparando com targets
   - Gera sugestões baseadas nos desvios
   - Usa `legacy_compatibility` como fonte principal de targets

3. **Tolerâncias para Status:**
   - **Ideal:** Z-score dentro da tolerância definida
   - **Ajuste leve:** Z-score moderadamente fora
   - **Corrigir:** Z-score significativamente fora

---

## ✅ PLANO DE EXECUÇÃO

### FASE 1: Atualização de Gêneros Existentes

#### 1.1 Padronizar Tolerâncias (conforme solicitado)
- LUFS: ±1.5 LUFS
- Pico real: ±1 dBTP
- Dinâmica: ±2 LU (ou DR)
- Frequências: faixas de 6-8 dB entre min e max

#### 1.2 Atualizar Estrutura dos Gêneros
- ✅ **funk_mandela** - Já está OK
- ✅ **funk_bruxaria** - Ajustar tolerâncias
- ✅ **funk_automotivo** - Converter para v2_hybrid_safe
- ✅ **eletrofunk** - Converter para v2_hybrid_safe
- ✅ **trap** - Converter para v2_hybrid_safe
- ✅ **trance** - Ajustar tolerâncias

### FASE 2: Remoção do Gênero "Eletrônico"

#### 2.1 Remover Arquivos
- Deletar `eletronico.json`
- Deletar arquivos de backup relacionados

#### 2.2 Remover do Manifesto
- Atualizar `genres.json` removendo entrada "eletronico"

### FASE 3: Criação de Novos Gêneros

#### 3.1 Tech House
- Criar `tech_house.json`
- Targets: LUFS -8.5, Peak -0.5, DR 7.5, Corr 0.70

#### 3.2 Techno
- Criar `techno.json`
- Targets: LUFS -9.0, Peak -0.5, DR 7.0, Corr 0.65

#### 3.3 House
- Criar `house.json`
- Targets: LUFS -9.5, Peak -0.8, DR 8.0, Corr 0.75

#### 3.4 Brazilian Phonk
- Criar `brazilian_phonk.json`
- Targets: LUFS -7.5, Peak -0.3, DR 8.5, Corr 0.85

#### 3.5 Phonk
- Criar `phonk.json`
- Targets: LUFS -8.0, Peak -0.5, DR 8.0, Corr 0.80

### FASE 4: Atualização do Manifesto

#### 4.1 Novo Manifesto de Gêneros
```json
{
  "genres": [
    { "key": "trance", "label": "Trance" },
    { "key": "funk_mandela", "label": "Funk Mandela" },
    { "key": "funk_bruxaria", "label": "Funk Bruxaria" },
    { "key": "funk_automotivo", "label": "Funk Automotivo" },
    { "key": "eletrofunk", "label": "Eletrofunk" },
    { "key": "trap", "label": "Trap" },
    { "key": "tech_house", "label": "Tech House" },
    { "key": "techno", "label": "Techno" },
    { "key": "house", "label": "House" },
    { "key": "brazilian_phonk", "label": "Brazilian Phonk" },
    { "key": "phonk", "label": "Phonk" }
  ]
}
```

### FASE 5: Validação

#### 5.1 Testes de Integração
- Verificar carregamento correto de todas as refs
- Validar cálculo de score
- Confirmar exibição na tabela
- Testar geração de sugestões

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Atualizar tolerâncias de todos os gêneros existentes
- [ ] Remover eletronico.json e arquivos relacionados
- [ ] Remover "eletronico" do genres.json
- [ ] Criar tech_house.json
- [ ] Criar techno.json
- [ ] Criar house.json
- [ ] Criar brazilian_phonk.json
- [ ] Criar phonk.json
- [ ] Atualizar genres.json com novos gêneros
- [ ] Validar estrutura JSON de todos os arquivos
- [ ] Testar carregamento no sistema
- [ ] Verificar exibição na UI
- [ ] Confirmar cálculo de score correto

---

## ⚠️ PONTOS DE ATENÇÃO

1. **Não alterar lógica de cálculo** - Apenas atualizar dados de referência
2. **Manter compatibilidade** - Preservar estrutura existente
3. **Backup automático** - Sistema já cria backups automaticamente
4. **Cache bust** - Cada arquivo deve ter timestamp único
5. **Validação JSON** - Garantir sintaxe correta

---

## 🎯 RESULTADO ESPERADO

- 11 gêneros no total (eram 8, removemos 1, adicionamos 5, ficamos com 12 - contando funk_consciente se mantido)
- Todos com estrutura padronizada v2_hybrid_safe
- Tolerâncias consistentes conforme especificação
- Sistema funcionando sem quebras
- Tabela de análise exibindo todos os gêneros
- Sugestões geradas corretamente
