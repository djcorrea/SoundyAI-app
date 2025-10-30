# 🧪 GUIA RÁPIDO DE TESTE - RELATÓRIOS PDF

## 🎯 OBJETIVO
Validar que o novo sistema de relatórios PDF está funcionando corretamente.

---

## 📋 PRÉ-REQUISITOS

✅ Servidor rodando (porta 3000)  
✅ Navegador Chrome ou Edge atualizado  
✅ Arquivo de áudio para teste (.wav, .mp3, .flac)

---

## 🚀 PASSO A PASSO

### **1. Iniciar Servidor**
```powershell
# Na raiz do projeto
python -m http.server 3000
```

### **2. Abrir Aplicação**
```
http://localhost:3000/public/
```

### **3. Fazer Upload de Áudio**
1. Clicar no botão "🎵 Analisar Áudio" (ou equivalente)
2. Selecionar arquivo de áudio
3. Aguardar análise completa (modal aparecerá com resultados)

### **4. Testar Download de Relatório**
1. No modal de resultados, localizar botão **"📄 Baixar Relatório"**
2. Clicar no botão
3. **Observar feedback visual:**
   - Deve aparecer: "⚙️ Gerando relatório PDF..."
   - Aguardar 1-3 segundos
   - Deve aparecer: "📄 Relatório PDF baixado com sucesso!"
4. **Verificar download:**
   - Arquivo baixado: `Relatorio_SoundyAI_[nome]_[data].pdf`
   - Tamanho esperado: 200KB - 1MB

### **5. Validar Conteúdo do PDF**

#### ✅ Checklist Visual:

**Header:**
- [ ] Logo/título "SoundyAI" aparece
- [ ] Subtítulo "Inteligência Artificial para Produtores Musicais"
- [ ] Data e hora corretas

**Score Card:**
- [ ] Score aparece (0-100)
- [ ] Classificação correta (Profissional, Avançado, etc.)
- [ ] Emoji 🎵 aparece
- [ ] Fundo gradiente roxo→azul

**Informações do Arquivo:**
- [ ] Nome do arquivo correto
- [ ] Duração formatada (min:seg)
- [ ] Sample rate correto
- [ ] Número de canais correto

**Métricas - Loudness:**
- [ ] Integrado (LUFS) tem valor ou "N/A"
- [ ] Curto Prazo (LUFS) tem valor ou "N/A"
- [ ] Momentâneo (LUFS) tem valor ou "N/A"
- [ ] LRA (LU) tem valor ou "N/A"

**Métricas - True Peak:**
- [ ] Pico Real (dBTP) tem valor ou "N/A"
- [ ] Clipping (samples) tem número
- [ ] Clipping (%) tem percentual
- [ ] Cor vermelha se clipping > 0, verde se 0

**Métricas - Dinâmica:**
- [ ] Dynamic Range (dB) tem valor ou "N/A"
- [ ] Crest Factor tem valor ou "N/A"

**Métricas - Stereo:**
- [ ] Largura Stereo (%) tem valor ou "N/A"
- [ ] Correlação tem valor ou "N/A"
- [ ] Compatibilidade Mono (%) tem valor ou "N/A"

**Espectro de Frequências:**
- [ ] Sub (20-60Hz) tem valor dB ou "N/A"
- [ ] Grave (60-250Hz) tem valor dB ou "N/A"
- [ ] Médio (250-4kHz) tem valor dB ou "N/A"
- [ ] Agudo (4k-20kHz) tem valor dB ou "N/A"

**Diagnóstico Automático:**
- [ ] Lista de problemas aparece (ou mensagem padrão)
- [ ] Bullets roxos aparecem

**Recomendações da IA:**
- [ ] Lista de sugestões aparece (ou mensagem padrão)
- [ ] Bullets roxos aparecem

**Footer:**
- [ ] "SoundyAI © 2025" aparece
- [ ] Subtítulo "Inteligência Artificial..." aparece
- [ ] Linha separadora aparece

**Layout Geral:**
- [ ] Fundo escuro (#0B0C14)
- [ ] Texto claro e legível
- [ ] Cards com bordas sutis
- [ ] Sem cortes no layout
- [ ] Tamanho A4 correto

---

## 🐛 TESTES DE ERROS

### **Teste 1: Sem análise disponível**
1. Abrir modal sem fazer upload
2. Clicar em "Baixar Relatório"
3. **Resultado esperado:** Alert "Nenhuma análise disponível"

### **Teste 2: Dependências não carregadas**
1. Desabilitar internet (para simular CDN offline)
2. Recarregar página
3. Fazer upload e tentar baixar relatório
4. **Resultado esperado:** Alert "Aguarde o carregamento das bibliotecas..."
5. Após 1 segundo, retry automático

### **Teste 3: Dados ausentes**
1. Fazer upload de áudio com análise parcial (simular)
2. Clicar em "Baixar Relatório"
3. **Resultado esperado:** 
   - PDF gerado normalmente
   - Valores ausentes mostram "N/A"
   - Sem erros no console

### **Teste 4: Nome de arquivo complexo**
1. Fazer upload de arquivo com nome: `áudio (teste) #1 @2024.wav`
2. Baixar relatório
3. **Resultado esperado:** Nome limpo: `Relatorio_SoundyAI_audio_teste_1_2024_.pdf`

---

## 🔍 VALIDAÇÃO NO CONSOLE DO NAVEGADOR

### **Abrir DevTools (F12) e verificar:**

#### ✅ Sem erros críticos:
- Não deve haver erros vermelhos relacionados a:
  - `undefined.toFixed()`
  - `Cannot read property of undefined`
  - `html2canvas error`
  - `jsPDF error`

#### ✅ Logs esperados:
```
📄 Gerando relatório PDF profissional...
✅ Relatório PDF gerado com sucesso: Relatorio_SoundyAI_[nome]_[data].pdf
```

#### ⚠️ Warnings aceitáveis:
- Avisos sobre fonts não carregadas (html2canvas)
- CORS warnings de imagens externas (não crítico)

---

## 📊 TESTES DE COMPATIBILIDADE

### **Chrome (Prioritário):**
- [ ] Windows 10/11
- [ ] macOS
- [ ] Linux

### **Edge (Prioritário):**
- [ ] Windows 10/11

### **Firefox (Opcional):**
- [ ] Qualquer OS
- ⚠️ Pode ter diferenças visuais menores

### **Safari (Opcional):**
- [ ] macOS
- [ ] iOS
- ⚠️ Pode ter problemas com html2canvas

---

## 🎯 CRITÉRIOS DE SUCESSO

### ✅ APROVADO se:
1. PDF é gerado sem erros
2. Todas as métricas aparecem (ou "N/A")
3. Layout está correto e legível
4. Branding SoundyAI está presente
5. Nome do arquivo é descritivo
6. Não há erros no console

### ❌ REPROVADO se:
1. Erro ao clicar no botão
2. PDF não é baixado
3. PDF está em branco ou corrompido
4. Métricas importantes estão ausentes (sem "N/A")
5. Layout está quebrado
6. Erros críticos no console

---

## 🛠️ TROUBLESHOOTING

### **Problema: "Aguarde o carregamento das bibliotecas..."**
- **Causa:** CDN ainda não carregou jsPDF ou html2canvas
- **Solução:** Aguardar 1-2 segundos e tentar novamente
- **Prevenção:** Verificar conexão com internet

### **Problema: PDF em branco**
- **Causa:** Erro no template HTML
- **Solução:** Verificar console para erros
- **Debug:** Inspecionar `#pdf-report-template` no DOM

### **Problema: Métricas aparecem como "undefined"**
- **Causa:** Normalização falhou
- **Solução:** Verificar estrutura de `currentModalAnalysis`
- **Fix:** Atualizar `normalizeAnalysisData()`

### **Problema: Layout cortado no PDF**
- **Causa:** Template maior que A4
- **Solução:** Reduzir padding ou font-size
- **Fix:** Ajustar template em `generateReportHTML()`

### **Problema: Erro "Cannot read property 'toFixed' of undefined"**
- **Causa:** Valor não formatado antes de usar `.toFixed()`
- **Solução:** Usar função `formatValue()` sempre
- **Status:** ✅ JÁ CORRIGIDO na normalização

---

## 📸 EVIDÊNCIAS DE TESTE

### **Capturar screenshots de:**
1. Modal com botão "Baixar Relatório"
2. Feedback "Gerando relatório PDF..."
3. Feedback "Relatório PDF baixado com sucesso!"
4. Pasta de downloads com arquivo PDF
5. PDF aberto (primeira página completa)
6. Console sem erros (DevTools)

---

## ✅ RELATÓRIO DE TESTE

### **Preencher após testes:**

**Data:** _____________  
**Testador:** _____________  
**Navegador:** _____________ (versão: _______)  
**OS:** _____________

**Resultados:**
- [ ] ✅ APROVADO - Tudo funcionando
- [ ] ⚠️ PARCIAL - Funciona com pequenos problemas
- [ ] ❌ REPROVADO - Não funciona ou erros críticos

**Observações:**
```
(escrever aqui qualquer problema encontrado ou sugestão de melhoria)
```

**Evidências anexadas:**
- [ ] Screenshot do modal
- [ ] Screenshot do PDF
- [ ] Console do navegador
- [ ] Arquivo PDF para validação

---

**🎯 TESTE RÁPIDO (5 minutos):**
1. Upload de áudio ✅
2. Clicar "Baixar Relatório" ✅
3. Abrir PDF ✅
4. Validar visual ✅
5. ✅ Aprovado!

---

**Próximo passo após testes:** Reportar resultados e, se aprovado, fazer deploy em produção.
