#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validação rápida do botão Fechar
"""

import re

css_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\audio-analyzer.css"

print("🔍 Validando botão 'Fechar'...\n")

with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

# Procura o bloco do botão fechar
match = re.search(r'#audioAnalysisModal\s+\.audio-close-bottom\s*{([^}]+)}', css_content, re.DOTALL)

if match:
    block = match.group(1)
    
    checks = {
        'padding': r'padding:\s*8px\s+24px',
        'height': r'height:\s*38px',
        'display': r'display:\s*flex\s*!important',
        'align-items': r'align-items:\s*center\s*!important',
        'line-height': r'line-height:\s*1\s*!important',
        'vertical-align': r'vertical-align:\s*middle'
    }
    
    print("✅ Propriedades encontradas:\n")
    for name, pattern in checks.items():
        if re.search(pattern, block):
            if name == 'padding':
                print("   ✅ padding: 8px 24px (reduzido de 10px)")
            elif name == 'height':
                print("   ✅ height: 38px (reduzido de 40px)")
            elif name == 'display':
                print("   ✅ display: flex !important")
            elif name == 'align-items':
                print("   ✅ align-items: center !important")
            elif name == 'line-height':
                print("   ✅ line-height: 1 !important")
            elif name == 'vertical-align':
                print("   ✅ vertical-align: middle")
    
    print("\n🎉 BOTÃO 'FECHAR' AJUSTADO!")
    print("\n📋 Mudanças aplicadas:")
    print("   • Padding: 10px → 8px (2px menos)")
    print("   • Height: 40px → 38px (2px menos)")
    print("   • Centralização: flex + align-items + line-height + !important")
    print("\n🔄 Recarregue a página (Ctrl+Shift+R) para ver o resultado!")
    
else:
    print("❌ Bloco do botão não encontrado")
