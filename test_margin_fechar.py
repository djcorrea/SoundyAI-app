#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validação do espaçamento do botão Fechar
"""

import re

css_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\audio-analyzer.css"

print("🔍 Validando espaçamento do botão 'Fechar'...\n")

with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

# Procura margin do botão fechar
match = re.search(r'#audioAnalysisModal\s+\.audio-close-bottom\s*{[^}]*margin:\s*(\d+)px\s+auto\s+0\s+auto', css_content, re.DOTALL)

if match:
    margin = match.group(1)
    print(f"✅ Margin-top encontrado: {margin}px\n")
    
    if margin == "20":
        print("🎉 PERFEITO! Botão subiu 12px!")
        print("\n📊 Comparação:")
        print("   • Antes: margin-top: 32px")
        print("   • Depois: margin-top: 20px")
        print("   • Diferença: -12px (botão subiu)")
        print("\n🔄 Recarregue a página (Ctrl+Shift+R) para ver!")
    elif margin == "32":
        print("⚠️ Ainda está com 32px (não mudou)")
    else:
        print(f"ℹ️ Valor atual: {margin}px")
else:
    print("❌ Não encontrou o margin")
