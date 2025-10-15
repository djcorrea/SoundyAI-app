#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para corrigir emojis corrompidos no index.html
"""

import json
import sys

# Define o caminho do arquivo
html_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\index.html"

print("🔧 Corrigindo emojis corrompidos no modal de gêneros...")

try:
    # Lê o arquivo com encoding UTF-8
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Contador de substituições
    count = 0
    
    # Corrige o emoji do Trap (substitui qualquer caractere corrompido por 💎)
    if 'data-genre="trap"' in content:
        # Procura o padrão e substitui
        import re
        # Padrão que pega a linha do Trap com emoji corrompido
        pattern = r'(<button class="genre-card" data-genre="trap">[\s\S]*?<span class="genre-icon">)[^<]+(</span>[\s\S]*?<span class="genre-name">Trap</span>)'
        replacement = r'\g<1>💎\g<2>'
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            content = new_content
            count += 1
            print("  ✅ Emoji do Trap corrigido para 💎")
    
    # Corrige o emoji do Brazilian Phonk (substitui bandeira corrompida por 🇧🇷)
    if 'data-genre="brazilian_phonk"' in content:
        # Padrão que pega a linha do Brazilian Phonk com emoji corrompido
        pattern = r'(<button class="genre-card" data-genre="brazilian_phonk">[\s\S]*?<span class="genre-icon">)[^<]+(</span>[\s\S]*?<span class="genre-name">Brazilian Phonk</span>)'
        replacement = r'\g<1>🇧🇷\g<2>'
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            content = new_content
            count += 1
            print("  ✅ Emoji do Brazilian Phonk corrigido para 🇧🇷")
    
    if count > 0:
        # Salva o arquivo corrigido
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"\n🎉 {count} emojis corrigidos com sucesso!")
    else:
        print("\n⚠️ Nenhum emoji corrompido encontrado ou já estava correto")
    
    sys.exit(0)

except Exception as e:
    print(f"\n❌ Erro ao corrigir emojis: {e}")
    sys.exit(1)
