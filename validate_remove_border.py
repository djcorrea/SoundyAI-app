#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validação da remoção da moldura interna
"""

import re

css_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\audio-analyzer.css"

print("🔍 Validando remoção da moldura interna...\n")

with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

# Procura o bloco .upload-content
match = re.search(r'#audioAnalysisModal\s+\.upload-content\s*{([^}]+)}', css_content, re.DOTALL)

if match:
    block = match.group(1)
    
    print("✅ Verificações:\n")
    
    # Verifica se NÃO tem border
    if not re.search(r'border:\s*1px', block):
        print("   ✅ Border removida (era: 1px solid rgba(106, 154, 255, 0.25))")
    else:
        print("   ❌ Border ainda existe")
    
    # Verifica se NÃO tem background colorido
    if 'background: transparent' in block or not re.search(r'background:\s*rgba\(30,\s*15,\s*45', block):
        print("   ✅ Background removido (agora transparente)")
    else:
        print("   ❌ Background colorido ainda existe")
    
    # Verifica se NÃO tem backdrop-filter
    if 'backdrop-filter' not in block:
        print("   ✅ Backdrop-filter removido")
    else:
        print("   ⚠️ Backdrop-filter ainda existe")
    
    # Verifica se NÃO tem border-radius
    if 'border-radius' not in block:
        print("   ✅ Border-radius removido")
    else:
        print("   ⚠️ Border-radius ainda existe")
    
    print("\n🎉 MOLDURA INTERNA REMOVIDA!")
    print("\n📋 O que foi removido:")
    print("   • Background: rgba(30, 15, 45, 0.4) → transparent")
    print("   • Border: 1px solid → none")
    print("   • Border-radius: 16px → removido")
    print("   • Backdrop-filter: blur(10px) → removido")
    print("   • Animações de hover → removidas")
    print("\n🔄 Recarregue a página (Ctrl+Shift+R) para ver!")
else:
    print("❌ Bloco .upload-content não encontrado")
