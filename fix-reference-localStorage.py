#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Script para adicionar suporte ao localStorage no fluxo de referência"""

import codecs
import re

file_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\audio-analyzer-integration.js"

# Ler arquivo em UTF-8
with codecs.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Padrão 1: Adicionar recuperação do localStorage em createAnalysisJob
pattern1 = r"(let referenceJobId = window\.__REFERENCE_JOB_ID__;[\s\S]{0,100}if \(mode === 'reference'\) \{[\s\S]{0,50}// Se ainda não existir referenceJobId)"

replacement1 = r"""\1, tenta recuperar do localStorage ou estado global
            // 🔄 RECUPERAÇÃO MULTI-FONTE: window > localStorage > estado global
            if (!referenceJobId) {
                referenceJobId = localStorage.getItem('referenceJobId');
                if (referenceJobId) {
                    console.log('[REF-LOAD ✅] Reference Job ID restaurado do localStorage:', referenceJobId);
                    // Sincronizar com window para manter consistência
                    window.__REFERENCE_JOB_ID__ = referenceJobId;
                }
            }
            
            // Se ainda não existir referenceJobId"""

# Tentar encontrar e substituir
if re.search(pattern1, content):
    content = re.sub(pattern1, replacement1, content, count=1)
    print("✅ Padrão 1 encontrado e substituído")
else:
    print("❌ Padrão 1 não encontrado - tentando abordagem alternativa")
    
    # Abordagem alternativa: buscar linha específica
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'Se ainda não existir referenceJobId, tenta recuperar do estado global' in line:
            # Inserir o código de localStorage ANTES desta linha
            indent = '            '
            new_lines = [
                f'{indent}// 🔄 RECUPERAÇÃO MULTI-FONTE: window > localStorage > estado global',
                f'{indent}if (!referenceJobId) {{',
                f'{indent}    referenceJobId = localStorage.getItem(\'referenceJobId\');',
                f'{indent}    if (referenceJobId) {{',
                f'{indent}        console.log(\'[REF-LOAD ✅] Reference Job ID restaurado do localStorage:\', referenceJobId);',
                f'{indent}        // Sincronizar com window para manter consistência',
                f'{indent}        window.__REFERENCE_JOB_ID__ = referenceJobId;',
                f'{indent}    }}',
                f'{indent}}}',
                f'{indent}'
            ]
            lines[i] = '\n'.join(new_lines) + lines[i]
            content = '\n'.join(lines)
            print(f"✅ Inserção feita na linha {i+1}")
            break
    else:
        print("❌ Não foi possível encontrar o local de inserção")

# Salvar arquivo
with codecs.open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Arquivo salvo com sucesso!")
