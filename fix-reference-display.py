#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Script para corrigir linha 2708 do audio-analyzer-integration.js"""

import codecs

file_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\audio-analyzer-integration.js"

# Ler arquivo em UTF-8
with codecs.open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Localizar linha com "await displayModalResults"
found_index = -1
for i, line in enumerate(lines):
    if 'await displayModalResults(normalizedResult);' in line and 2706 <= i <= 2710:
        found_index = i
        print(f"✅ Linha encontrada no índice: {i} (linha {i+1})")
        print(f"Conteúdo: {line.strip()}")
        break

if found_index >= 0:
    # Criar novo conteúdo
    new_lines = []
    
    # Adicionar linhas anteriores
    new_lines.extend(lines[:found_index])
    
    # Adicionar novo código
    new_code = """            // 🔥 CORREÇÃO: Preparar dados para comparação A/B correta
            console.log('[REFERENCE-FLOW] Segunda música concluída');
            console.log('[REFERENCE-FLOW ✅] Montando comparação entre faixas');
            
            // Usar PRIMEIRA música como base do modal
            const userAnalysis = state.previousAnalysis || state.userAnalysis;
            const referenceAnalysisData = normalizedResult || state.referenceAnalysis;
            
            console.log('[REFERENCE-COMPARE] Valor = 1ª faixa:', userAnalysis?.fileName || userAnalysis?.metadata?.fileName);
            console.log('[REFERENCE-COMPARE] Alvo = 2ª faixa:', referenceAnalysisData?.fileName || referenceAnalysisData?.metadata?.fileName);
            
            // Marcar no normalizedResult que é modo referência com dados corretos
            normalizedResult._isReferenceMode = true;
            normalizedResult._userAnalysis = userAnalysis;
            normalizedResult._referenceAnalysis = referenceAnalysisData;
            
            await displayModalResults(normalizedResult);
            console.log('[FIX-REFERENCE] Modal aberto após segunda análise');
"""
    
    new_lines.append(new_code)
    
    # Pular linhas antigas (await e console.log)
    skip_index = found_index + 1
    while skip_index < len(lines) and '[FIX-REFERENCE]' in lines[skip_index]:
        skip_index += 1
    
    # Adicionar linhas restantes
    new_lines.extend(lines[skip_index:])
    
    # Salvar arquivo
    with codecs.open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print(f"✅ Arquivo modificado com sucesso!")
    print(f"Linhas adicionadas: 15")
    print(f"Total de linhas antes: {len(lines)}")
    print(f"Total de linhas depois: {len(new_lines)}")
else:
    print("❌ Linha não encontrada!")
