# 📚 GRANULAR V1 - Índice de Documentação

## 🎯 INÍCIO RÁPIDO

**Para começar imediatamente**, siga esta ordem:

1. **Entender o sistema**: [`GRANULAR_V1_IMPLEMENTATION_SUMMARY.md`](./GRANULAR_V1_IMPLEMENTATION_SUMMARY.md)
2. **Testar básico**: [`GRANULAR_V1_TESTING_GUIDE.md`](./GRANULAR_V1_TESTING_GUIDE.md) (seção "Teste Rápido")
3. **Validar instalação**: [`GRANULAR_V1_FINAL_VALIDATION.md`](./GRANULAR_V1_FINAL_VALIDATION.md) (script PowerShell)

---

## 📖 DOCUMENTOS POR FUNÇÃO

### 👨‍💻 Para Desenvolvedores (Implementação)

| Documento | Objetivo | Tempo Leitura |
|-----------|----------|---------------|
| **[IMPLEMENTATION_SUMMARY.md](./GRANULAR_V1_IMPLEMENTATION_SUMMARY.md)** | Visão completa da implementação, arquivos criados/modificados, payloads esperados | 15-20 min |
| **[WORKER_INTEGRATION.md](./GRANULAR_V1_WORKER_INTEGRATION.md)** | Código exato para integrar worker, exemplos de modificação, logging | 10 min |
| **Código fonte**: `work/lib/audio/features/spectral-bands-granular.js` | Implementação do módulo granular (classe + funções) | 20 min |

**Próximo passo**: Modificar `work/index.js` seguindo `WORKER_INTEGRATION.md`

---

### 🧪 Para QA/Testers

| Documento | Objetivo | Tempo Leitura |
|-----------|----------|---------------|
| **[TESTING_GUIDE.md](./GRANULAR_V1_TESTING_GUIDE.md)** | Testes passo a passo, troubleshooting, validação de compatibilidade | 12 min |
| **[FINAL_VALIDATION.md](./GRANULAR_V1_FINAL_VALIDATION.md)** | Script de validação de arquivos, checklist de testes, métricas de sucesso | 8 min |

**Próximo passo**: Executar "Teste Rápido (5 minutos)" no `TESTING_GUIDE.md`

---

### 👀 Para Reviewers (Code Review)

| Documento | Objetivo | Tempo Leitura |
|-----------|----------|---------------|
| **[FINAL_VALIDATION.md](./GRANULAR_V1_FINAL_VALIDATION.md)** | Resumo executivo, checklist de segurança, pontos de atenção | 10 min |
| **[IMPLEMENTATION_SUMMARY.md](./GRANULAR_V1_IMPLEMENTATION_SUMMARY.md)** | Detalhes técnicos, compatibilidade, rollback | 15 min |
| **Diff**: `work/api/audio/core-metrics.js` | Mudanças no roteador condicional | 5 min |
| **Diff**: `work/api/audio/json-output.js` | Campos aditivos no payload | 3 min |

**Próximo passo**: Revisar seção "Pontos de Atenção" no `FINAL_VALIDATION.md`

---

### 🚀 Para DevOps (Deploy)

| Documento | Objetivo | Tempo Leitura |
|-----------|----------|---------------|
| **[FINAL_VALIDATION.md](./GRANULAR_V1_FINAL_VALIDATION.md)** | Checklist de segurança, rollback, monitoramento | 8 min |
| **[TESTING_GUIDE.md](./GRANULAR_V1_TESTING_GUIDE.md)** | Troubleshooting, cenários de erro | 10 min |

**Variável de ambiente**: `ANALYZER_ENGINE=legacy|granular_v1` (padrão: `legacy`)  
**Rollback**: Mudar `.env` → `ANALYZER_ENGINE=legacy` e reiniciar workers

---

## 🗂️ ESTRUTURA DE ARQUIVOS

### 📦 Arquivos Core (Código)
```
work/
├── lib/audio/features/
│   └── spectral-bands-granular.js  ← Módulo principal (550+ linhas)
├── api/audio/
│   ├── core-metrics.js             ← Roteador condicional (modificado)
│   └── json-output.js              ← Campos aditivos (modificado)

references/
└── techno.v1.json                   ← Referência Techno (13 sub-bandas)

.env.example                         ← Documentação feature flag (modificado)
```

### 📚 Arquivos de Documentação
```
GRANULAR_V1_IMPLEMENTATION_SUMMARY.md   ← Visão completa (650+ linhas)
GRANULAR_V1_TESTING_GUIDE.md           ← Guia de testes (450+ linhas)
GRANULAR_V1_WORKER_INTEGRATION.md      ← Integração worker (400+ linhas)
GRANULAR_V1_FINAL_VALIDATION.md        ← Validação final (500+ linhas)
GRANULAR_V1_INDEX.md                   ← Este arquivo (índice)
```

---

## 🎓 PERGUNTAS FREQUENTES

### Como funciona o sistema?
- Sistema analisa áudio em **sub-bandas de 20 Hz** (vs 7 bandas largas do legacy)
- Compara energia com **target ± σ** (distribuição estatística)
- Classifica cada sub-banda: **ideal** (≤1σ), **adjust** (≤2σ), **fix** (>2σ)
- Agrega sub-bandas em **7 grupos** (compatibilidade frontend)
- Gera **sugestões inteligentes** (boost/cut com frequência + amount)

**Documento**: `IMPLEMENTATION_SUMMARY.md` → Seção "Módulo Granular"

---

### O frontend precisa mudar?
❌ **Não**. O sistema garante compatibilidade total:
- Bandas principais (7) sempre presentes no payload
- Campos granular/suggestions são **aditivos** (opcionais)
- Frontend continua exibindo 7 bandas normalmente

**Documento**: `IMPLEMENTATION_SUMMARY.md` → Seção "Compatibilidade Garantida"

---

### Como ativo/desativo o granular?
Editar `.env`:
```bash
# Modo legacy (atual, seguro)
ANALYZER_ENGINE=legacy

# Modo granular (novo, experimental)
ANALYZER_ENGINE=granular_v1
```

Reiniciar workers após mudança.

**Documento**: `TESTING_GUIDE.md` → Seção "Teste Rápido"

---

### E se der erro no granular?
✅ **Fallback automático** para legacy:
- Sem referência carregada → usa legacy
- Erro no cálculo → usa legacy
- Referência corrompida → usa legacy

Logs sempre indicam qual engine foi usado.

**Documento**: `FINAL_VALIDATION.md` → Seção "Rollback"

---

### Posso usar granular sem modificar o worker?
⚠️ **Parcialmente**:
- Código granular já está instalado
- Roteador condicional já funciona
- **MAS**: Sem integração worker, referência não é carregada
- Resultado: Sistema sempre faz fallback para legacy

**Solução**: Seguir `WORKER_INTEGRATION.md` (5-10 linhas de código)

---

### LUFS/True Peak/DR mudam com granular?
❌ **Não**. Apenas análise espectral muda:
- LUFS, True Peak, DR, LRA, Correlation → **idênticos**
- Bandas espectrais → **granulares** (mais detalhadas)
- Score → pode variar (algoritmo de bandas diferente)

**Documento**: `TESTING_GUIDE.md` → Seção "Verificação de Compatibilidade"

---

### Como adiciono mais gêneros?
1. Criar JSON de referência: `references/<genero>.v1.json`
2. Estrutura igual a `techno.v1.json`:
   - `bands[]` com targets e σ
   - `grouping{}` mapeando sub-bandas → grupos
   - `severity{}` com pesos e thresholds
3. Calibrar com 20-30 tracks profissionais do gênero
4. Validar com 10 tracks não usadas na calibração

**Documento**: `IMPLEMENTATION_SUMMARY.md` → Seção "Próximos Passos" → Item 2

---

### Qual a performance esperada?
📊 **Estimativas**:
- Overhead: ~10-15% (vs legacy)
- Latência adicional: ~50-100ms por faixa
- Memória: +5-10%

⚠️ **Não testado em produção ainda** (requer monitoramento).

**Documento**: `FINAL_VALIDATION.md` → Seção "Pontos de Atenção"

---

## 🛠️ COMANDOS ÚTEIS

### Validar instalação
```powershell
# Verificar arquivos criados
Test-Path "work\lib\audio\features\spectral-bands-granular.js"
Test-Path "references\techno.v1.json"

# Verificar modificações
Select-String -Path "work\api\audio\core-metrics.js" -Pattern "analyzeGranularSpectralBands"
Select-String -Path "work\api\audio\json-output.js" -Pattern "engineVersion"
```

### Testar sintaxe (sem rodar)
```powershell
node -e "import('./work/lib/audio/features/spectral-bands-granular.js').then(() => console.log('✅ OK')).catch(e => console.error('❌', e.message))"
```

### Validar JSON de referência
```powershell
$json = Get-Content "references\techno.v1.json" | ConvertFrom-Json
Write-Host "Bands: $($json.bands.Count), Groups: $($json.grouping.PSObject.Properties.Count)"
```

### Ativar/Desativar granular
```powershell
# Ativar
"ANALYZER_ENGINE=granular_v1" | Set-Content ".env"

# Desativar
"ANALYZER_ENGINE=legacy" | Set-Content ".env"
```

---

## 🗺️ ROADMAP DE IMPLEMENTAÇÃO

### ✅ Fase 1: Core (COMPLETO)
- [x] Módulo granular
- [x] Roteador condicional
- [x] Campos aditivos JSON
- [x] Referência Techno
- [x] Documentação completa

### ⏳ Fase 2: Integração (PENDENTE)
- [ ] Modificar worker (`work/index.js`)
- [ ] Testar com job real
- [ ] Validar logs
- [ ] Criar referências para outros gêneros

### ⏳ Fase 3: Qualidade (PENDENTE)
- [ ] Calibrar referências com tracks reais
- [ ] Criar testes automatizados
- [ ] Monitorar performance em produção

### ⏳ Fase 4: Otimização (PENDENTE)
- [ ] Cache de referências
- [ ] Quickselect para mediana
- [ ] Processar frames em paralelo

### ⏳ Fase 5: UX (PENDENTE)
- [ ] Frontend exibir sub-bandas
- [ ] Dashboard de monitoramento
- [ ] Visualização de sugestões

---

## 📞 SUPORTE

### Dúvidas sobre Implementação
📖 **Documento**: `IMPLEMENTATION_SUMMARY.md`  
💻 **Código**: `work/lib/audio/features/spectral-bands-granular.js` (comentado)

### Problemas ao Testar
📖 **Documento**: `TESTING_GUIDE.md` → Seção "Troubleshooting"  
🔍 **Logs**: Procurar por `[GRANULAR]` ou `[SPECTRAL_BANDS]` no console

### Erro ao Integrar Worker
📖 **Documento**: `WORKER_INTEGRATION.md`  
🔧 **Exemplo**: Ver seção "Código Atual vs Modificado"

### Deploy/Produção
📖 **Documento**: `FINAL_VALIDATION.md` → Seção "Checklist de Segurança"  
🛡️ **Rollback**: Mudar `.env` → `ANALYZER_ENGINE=legacy`

---

## ✅ CHECKLIST DE INÍCIO

Marque conforme avança:

- [ ] Li o `IMPLEMENTATION_SUMMARY.md` (visão geral)
- [ ] Executei script de validação (arquivos instalados)
- [ ] Testei modo legacy (comportamento atual preservado)
- [ ] Li o `WORKER_INTEGRATION.md` (próximo passo)
- [ ] Modifiquei `work/index.js` para carregar referência
- [ ] Testei com job real (granular_v1 ativo)
- [ ] Validei payload (campos granular/suggestions presentes)
- [ ] Testei rollback (voltar para legacy)

---

**Data**: 16 de outubro de 2025  
**Versão**: granular_v1  
**Status**: ✅ Implementação core completa
