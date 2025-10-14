# 🧪 GUIA DE VALIDAÇÃO E TESTES - SISTEMA DE REFERÊNCIAS ATUALIZADO

**Data:** 14 de outubro de 2025  
**Status:** Pronto para testes

---

## 🎯 OBJETIVO

Validar que todas as mudanças no sistema de referências estão funcionando corretamente e que nenhuma funcionalidade foi quebrada.

---

## ✅ PRÉ-REQUISITOS

1. ✅ Todos os arquivos JSON criados/atualizados
2. ✅ Gênero "eletrônico" removido
3. ✅ Manifesto `genres.json` atualizado
4. ✅ Referências em arquivos de config atualizadas

---

## 🔬 TESTES A EXECUTAR

### TESTE 1: Carregamento do Manifesto de Gêneros

**Objetivo:** Verificar que todos os 12 gêneros são carregados corretamente.

**Como testar:**
1. Abra a aplicação no navegador
2. Abra o Console (F12)
3. Execute:

```javascript
// Limpar cache
window.REFS_BYPASS_CACHE = true;
localStorage.clear();
sessionStorage.clear();

// Carregar manifesto
fetch('/public/refs/out/genres.json?v=' + Date.now())
  .then(r => r.json())
  .then(data => {
    console.log('📊 Total de gêneros:', data.genres.length);
    console.log('📋 Gêneros disponíveis:');
    data.genres.forEach(g => console.log(`  - ${g.key} (${g.label})`));
  });
```

**Resultado esperado:**
```
📊 Total de gêneros: 12
📋 Gêneros disponíveis:
  - trance (Trance)
  - funk_mandela (Funk Mandela)
  - funk_bruxaria (Funk Bruxaria)
  - funk_automotivo (Funk Automotivo)
  - eletrofunk (Eletrofunk)
  - funk_consciente (Funk Consciente)
  - trap (Trap)
  - tech_house (Tech House)
  - techno (Techno)
  - house (House)
  - brazilian_phonk (Brazilian Phonk)
  - phonk (Phonk)
```

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### TESTE 2: Carregamento Individual de Referências

**Objetivo:** Verificar que cada arquivo JSON individual carrega corretamente.

**Como testar:**

```javascript
const genresToTest = [
  'tech_house', 'techno', 'house', 'brazilian_phonk', 'phonk',
  'trap', 'eletrofunk', 'funk_automotivo', 'trance', 
  'funk_mandela', 'funk_bruxaria'
];

async function testAllGenres() {
  console.log('🧪 Testando carregamento de todos os gêneros...\n');
  
  for (const genre of genresToTest) {
    try {
      const response = await fetch(`/public/refs/out/${genre}.json?v=${Date.now()}`);
      const data = await response.json();
      const genreData = data[genre];
      
      if (!genreData) {
        console.error(`❌ ${genre}: Estrutura inválida`);
        continue;
      }
      
      const legacy = genreData.legacy_compatibility;
      if (!legacy) {
        console.error(`❌ ${genre}: legacy_compatibility ausente`);
        continue;
      }
      
      // Verificar campos essenciais
      const hasLufs = Number.isFinite(legacy.lufs_target);
      const hasPeak = Number.isFinite(legacy.true_peak_target);
      const hasDR = Number.isFinite(legacy.dr_target);
      const hasBands = legacy.bands && Object.keys(legacy.bands).length >= 8;
      
      if (hasLufs && hasPeak && hasDR && hasBands) {
        console.log(`✅ ${genre}: OK`, {
          lufs: legacy.lufs_target,
          peak: legacy.true_peak_target,
          dr: legacy.dr_target,
          bands: Object.keys(legacy.bands).length
        });
      } else {
        console.error(`❌ ${genre}: Campos faltando`, {
          hasLufs, hasPeak, hasDR, hasBands
        });
      }
      
    } catch (error) {
      console.error(`❌ ${genre}: Erro ao carregar:`, error.message);
    }
  }
  
  console.log('\n✅ Teste concluído!');
}

testAllGenres();
```

**Resultado esperado:**
Todas as linhas devem mostrar ✅ OK com valores numéricos válidos.

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### TESTE 3: Validação de Tolerâncias Padronizadas

**Objetivo:** Confirmar que as tolerâncias foram padronizadas conforme especificação.

**Como testar:**

```javascript
const expectedTolerances = {
  tol_lufs: 1.5,
  tol_true_peak: 1,
  tol_dr: 2,
  tol_lra: 2.5
};

async function testTolerances() {
  console.log('🎯 Testando tolerâncias padronizadas...\n');
  
  const genresToTest = ['tech_house', 'techno', 'house', 'brazilian_phonk', 'phonk'];
  
  for (const genre of genresToTest) {
    const response = await fetch(`/public/refs/out/${genre}.json?v=${Date.now()}`);
    const data = await response.json();
    const legacy = data[genre].legacy_compatibility;
    
    const matches = {
      lufs: legacy.tol_lufs === expectedTolerances.tol_lufs,
      peak: legacy.tol_true_peak === expectedTolerances.tol_true_peak,
      dr: legacy.tol_dr === expectedTolerances.tol_dr,
      lra: legacy.tol_lra === expectedTolerances.tol_lra
    };
    
    const allMatch = Object.values(matches).every(v => v);
    
    if (allMatch) {
      console.log(`✅ ${genre}: Tolerâncias corretas`);
    } else {
      console.error(`❌ ${genre}: Tolerâncias incorretas`, {
        atual: {
          lufs: legacy.tol_lufs,
          peak: legacy.tol_true_peak,
          dr: legacy.tol_dr,
          lra: legacy.tol_lra
        },
        esperado: expectedTolerances
      });
    }
  }
  
  console.log('\n✅ Teste concluído!');
}

testTolerances();
```

**Resultado esperado:**
Todos os gêneros novos devem ter tolerâncias exatamente como especificado.

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### TESTE 4: Verificação de Remoção do "Eletrônico"

**Objetivo:** Confirmar que o gênero "eletrônico" não existe mais no sistema.

**Como testar:**

```javascript
// Teste 1: Verificar manifesto
fetch('/public/refs/out/genres.json?v=' + Date.now())
  .then(r => r.json())
  .then(data => {
    const hasEletronico = data.genres.some(g => 
      g.key === 'eletronico' || g.label.toLowerCase().includes('eletrônico')
    );
    
    if (hasEletronico) {
      console.error('❌ "eletronico" ainda existe no manifesto!');
    } else {
      console.log('✅ "eletronico" removido do manifesto');
    }
  });

// Teste 2: Tentar carregar arquivo
fetch('/public/refs/out/eletronico.json?v=' + Date.now())
  .then(r => {
    if (r.ok) {
      console.error('❌ Arquivo eletronico.json ainda existe!');
    } else {
      console.log('✅ Arquivo eletronico.json não existe (404 esperado)');
    }
  });
```

**Resultado esperado:**
- Manifesto não contém "eletronico"
- Arquivo eletronico.json retorna 404

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### TESTE 5: Interface de Seleção de Gêneros

**Objetivo:** Verificar que o dropdown de gêneros exibe todos os 12 gêneros.

**Como testar:**
1. Abra a página de análise de áudio
2. Localize o select de gêneros (geralmente `#audioRefGenreSelect`)
3. Execute no console:

```javascript
const select = document.getElementById('audioRefGenreSelect');
if (!select) {
  console.error('❌ Select de gêneros não encontrado!');
} else {
  console.log('📋 Opções no select:');
  Array.from(select.options).forEach((opt, i) => {
    console.log(`  ${i+1}. ${opt.value} - ${opt.textContent}`);
  });
  
  const totalOptions = select.options.length;
  if (totalOptions >= 12) {
    console.log(`✅ Total de opções: ${totalOptions} (12+ esperado)`);
  } else {
    console.error(`❌ Total de opções: ${totalOptions} (esperado 12+)`);
  }
}
```

**Resultado esperado:**
Pelo menos 12 opções devem estar visíveis no select.

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### TESTE 6: Análise Completa com Novo Gênero

**Objetivo:** Fazer uma análise completa usando um dos novos gêneros.

**Passo a passo:**
1. Selecione um gênero novo (ex: "Tech House")
2. Faça upload de um arquivo de áudio
3. Aguarde a análise
4. Verifique:
   - ✅ Tabela de métricas é exibida
   - ✅ Valores de "Ideal" aparecem
   - ✅ Status (cores) são exibidos corretamente
   - ✅ Sugestões são geradas
   - ✅ Score final é calculado

**Como verificar no console:**

```javascript
// Após a análise completar
console.log('📊 Dados da análise:', window.PROD_AI_ANALYSIS_RESULT);
console.log('🎯 Referência ativa:', window.PROD_AI_REF_DATA);
console.log('💡 Sugestões:', window.PROD_AI_ANALYSIS_RESULT?.suggestions);
```

**Resultado esperado:**
- Análise completa sem erros
- Tabela renderizada corretamente
- Sugestões geradas
- Score calculado

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### TESTE 7: Validação de Bandas Espectrais

**Objetivo:** Confirmar que todas as 8 bandas estão presentes e com valores válidos.

**Como testar:**

```javascript
const expectedBands = ['sub', 'low_bass', 'upper_bass', 'low_mid', 'mid', 'high_mid', 'brilho', 'presenca'];

async function testBands() {
  console.log('🎵 Testando bandas espectrais...\n');
  
  const genresToTest = ['tech_house', 'techno', 'house', 'brazilian_phonk', 'phonk'];
  
  for (const genre of genresToTest) {
    const response = await fetch(`/public/refs/out/${genre}.json?v=${Date.now()}`);
    const data = await response.json();
    const bands = data[genre].legacy_compatibility.bands;
    
    const bandsFound = Object.keys(bands);
    const allPresent = expectedBands.every(b => bandsFound.includes(b));
    
    if (allPresent && bandsFound.length === 8) {
      console.log(`✅ ${genre}: 8 bandas completas`);
      
      // Verificar valores válidos (entre -50 e 0 dB)
      const allValid = Object.entries(bands).every(([name, data]) => {
        const valid = data.target_db >= -50 && data.target_db <= 0;
        if (!valid) {
          console.warn(`  ⚠️ ${name}: ${data.target_db} dB (fora da faixa esperada)`);
        }
        return valid;
      });
      
      if (allValid) {
        console.log(`  ✅ Todos os valores são válidos`);
      }
    } else {
      console.error(`❌ ${genre}: Bandas faltando`, {
        esperadas: expectedBands,
        encontradas: bandsFound
      });
    }
  }
  
  console.log('\n✅ Teste concluído!');
}

testBands();
```

**Resultado esperado:**
Todos os gêneros devem ter exatamente 8 bandas com valores entre -50 e 0 dB.

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### TESTE 8: Cálculo de Z-Score

**Objetivo:** Verificar que o sistema calcula corretamente os z-scores com as novas referências.

**Como testar:**
1. Faça uma análise completa
2. No console, execute:

```javascript
// Verificar z-scores calculados
if (window.PROD_AI_ANALYSIS_RESULT?.enhancedMetrics?.zScores) {
  const zScores = window.PROD_AI_ANALYSIS_RESULT.enhancedMetrics.zScores;
  
  console.log('📊 Z-Scores calculados:');
  Object.entries(zScores).forEach(([metric, value]) => {
    const status = Math.abs(value) <= 1 ? '✅ Ideal' : 
                   Math.abs(value) <= 2 ? '⚠️ Ajuste leve' : 
                   '❌ Corrigir';
    console.log(`  ${metric}: ${value.toFixed(2)} ${status}`);
  });
} else {
  console.error('❌ Z-scores não foram calculados!');
}
```

**Resultado esperado:**
Z-scores devem ser calculados para todas as métricas principais.

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

## 📋 CHECKLIST FINAL DE VALIDAÇÃO

### Testes Funcionais
- [ ] TESTE 1: Manifesto carrega 12 gêneros
- [ ] TESTE 2: Todos os JSONs individuais carregam
- [ ] TESTE 3: Tolerâncias estão padronizadas
- [ ] TESTE 4: "Eletrônico" foi removido
- [ ] TESTE 5: Dropdown exibe 12+ gêneros
- [ ] TESTE 6: Análise completa funciona com novo gênero
- [ ] TESTE 7: Todas as bandas espectrais estão presentes
- [ ] TESTE 8: Z-scores são calculados corretamente

### Testes Visuais
- [ ] Tabela de métricas renderiza corretamente
- [ ] Cores de status (verde/amarelo/vermelho) aparecem
- [ ] Valores de "Ideal" são exibidos
- [ ] Sugestões aparecem na interface
- [ ] Score final é exibido

### Testes de Compatibilidade
- [ ] Cache funciona corretamente
- [ ] Troca entre gêneros funciona
- [ ] Reload da página mantém seleção
- [ ] Fallback para embedded refs funciona

---

## 🐛 RESOLUÇÃO DE PROBLEMAS

### Problema: Gêneros novos não aparecem no dropdown

**Solução:**
```javascript
// Limpar cache completamente
window.REFS_BYPASS_CACHE = true;
delete window.__refDataCache;
window.__refDataCache = {};
delete window.__genreManifest;
localStorage.clear();
sessionStorage.clear();

// Forçar reload hard
location.reload(true);
```

### Problema: Arquivo JSON não carrega (404)

**Verificar:**
1. Nome do arquivo está correto (ex: `tech_house.json`)
2. Arquivo está na pasta `public/refs/out/`
3. Servidor está servindo arquivos estáticos corretamente

**Teste direto:**
```bash
# No terminal (se estiver rodando http.server)
curl http://localhost:3000/public/refs/out/tech_house.json
```

### Problema: Valores da tabela aparecem como "null" ou "undefined"

**Causa provável:** Estrutura do JSON não está correta

**Verificar:**
```javascript
fetch('/public/refs/out/tech_house.json?v=' + Date.now())
  .then(r => r.json())
  .then(data => {
    console.log('Estrutura:', data);
    console.log('Legacy compatibility:', data.tech_house?.legacy_compatibility);
  });
```

### Problema: Sugestões não são geradas

**Verificar:**
1. Enhanced Suggestion Engine está carregado
2. Referências foram carregadas corretamente
3. Análise foi concluída

```javascript
console.log('Engine disponível:', typeof window.EnhancedSuggestionEngine);
console.log('Referência ativa:', window.PROD_AI_REF_DATA);
console.log('Análise completa:', window.PROD_AI_ANALYSIS_RESULT);
```

---

## 📞 SUPORTE

Se algum teste falhar:

1. **Anote o erro exato** (copie mensagens do console)
2. **Tire screenshot** da interface
3. **Verifique o console do navegador** (F12)
4. **Teste em modo anônimo** para descartar cache
5. **Reporte o problema** com todos os detalhes

---

## ✅ RESULTADO FINAL

Após executar todos os testes, preencher:

**Data do teste:** ___/___/_____  
**Navegador:** _______________  
**Versão:** _______________  

**Testes passados:** ___ / 8  
**Status geral:** ⬜ Aprovado | ⬜ Com problemas | ⬜ Reprovado

**Observações:**
_________________________________________________
_________________________________________________
_________________________________________________

---

**Assinatura:** _____________________  
**Data:** ___/___/_____
