#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de validação das correções do modal de gêneros
"""

import re
import sys

html_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\index.html"
css_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\audio-analyzer.css"

print("🔍 VALIDAÇÃO DAS CORREÇÕES DO MODAL DE GÊNEROS\n")
print("=" * 60)

errors = []
warnings = []
success = []

# ========================================
# 1. Verificar emojis corretos no HTML
# ========================================
print("\n📝 1. Verificando emojis no HTML...")

with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Verifica Trap
if 'data-genre="trap"' in html_content:
    trap_match = re.search(r'data-genre="trap"[\s\S]*?<span class="genre-icon">([^<]+)</span>', html_content)
    if trap_match:
        emoji = trap_match.group(1)
        if emoji == '💎':
            success.append("✅ Trap tem emoji correto: 💎")
        else:
            errors.append(f"❌ Trap com emoji errado: {repr(emoji)}")
    else:
        errors.append("❌ Trap não encontrado no HTML")

# Verifica Brazilian Phonk
if 'data-genre="brazilian_phonk"' in html_content:
    phonk_match = re.search(r'data-genre="brazilian_phonk"[\s\S]*?<span class="genre-icon">([^<]+)</span>', html_content)
    if phonk_match:
        emoji = phonk_match.group(1)
        if emoji == '🇧🇷':
            success.append("✅ Brazilian Phonk tem emoji correto: 🇧🇷")
        else:
            errors.append(f"❌ Brazilian Phonk com emoji errado: {repr(emoji)}")
    else:
        errors.append("❌ Brazilian Phonk não encontrado no HTML")

# ========================================
# 2. Verificar CSS do modal
# ========================================
print("\n🎨 2. Verificando CSS do modal...")

with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

# Verifica container do modal
if 'max-height: 85vh' in css_content:
    success.append("✅ Modal com altura reduzida (85vh)")
else:
    warnings.append("⚠️ Altura do modal pode estar incorreta")

# Verifica grid com 4 colunas
if 'grid-template-columns: repeat(4, 1fr)' in css_content:
    success.append("✅ Grid configurado para 4 colunas")
else:
    errors.append("❌ Grid não está configurado para 4 colunas")

# Verifica padding dos cards
if re.search(r'\.genre-card\s*{[^}]*padding:\s*14px\s+10px', css_content, re.DOTALL):
    success.append("✅ Cards com padding reduzido (14px 10px)")
else:
    warnings.append("⚠️ Padding dos cards pode estar incorreto")

# Verifica tamanho do emoji
if re.search(r'\.genre-icon\s*{[^}]*font-size:\s*2rem', css_content, re.DOTALL):
    success.append("✅ Ícones com tamanho reduzido (2rem)")
else:
    warnings.append("⚠️ Tamanho dos ícones pode estar incorreto")

# Verifica tamanho do título
if re.search(r'\.genre-modal-title\s*{[^}]*font-size:\s*2rem', css_content, re.DOTALL):
    success.append("✅ Título com tamanho reduzido (2rem)")
else:
    warnings.append("⚠️ Tamanho do título pode estar incorreto")

# Verifica responsividade
media_queries = [
    (r'@media\s*\(max-width:\s*768px\)', "Tablet (768px)"),
    (r'@media\s*\(max-width:\s*480px\)', "Smartphone (480px)"),
    (r'@media\s*\(max-width:\s*360px\)', "Tela pequena (360px)")
]

for pattern, name in media_queries:
    if re.search(pattern, css_content):
        success.append(f"✅ Media query para {name} configurada")
    else:
        errors.append(f"❌ Media query para {name} não encontrada")

# ========================================
# 3. Contar gêneros no modal
# ========================================
print("\n🎵 3. Verificando quantidade de gêneros...")

genre_buttons = re.findall(r'<button class="genre-card" data-genre="([^"]+)">', html_content)
genre_count = len(genre_buttons)

if genre_count == 12:
    success.append(f"✅ Modal tem {genre_count} gêneros (correto)")
else:
    warnings.append(f"⚠️ Modal tem {genre_count} gêneros (esperado: 12)")

print(f"   Gêneros encontrados: {', '.join(genre_buttons)}")

# ========================================
# 4. Verificar botão Fechar
# ========================================
print("\n🔘 4. Verificando botão Fechar...")

if 'genre-modal-close' in html_content:
    success.append("✅ Botão Fechar encontrado no HTML")
else:
    errors.append("❌ Botão Fechar não encontrado")

if '.genre-modal-close' in css_content:
    success.append("✅ Estilo do botão Fechar encontrado no CSS")
else:
    errors.append("❌ Estilo do botão Fechar não encontrado")

# ========================================
# RESULTADO FINAL
# ========================================
print("\n" + "=" * 60)
print("\n📊 RESULTADO DA VALIDAÇÃO:\n")

if success:
    print("✅ SUCESSOS:")
    for item in success:
        print(f"   {item}")

if warnings:
    print("\n⚠️ AVISOS:")
    for item in warnings:
        print(f"   {item}")

if errors:
    print("\n❌ ERROS:")
    for item in errors:
        print(f"   {item}")

print("\n" + "=" * 60)

if errors:
    print("\n❌ VALIDAÇÃO FALHOU - Há erros que precisam ser corrigidos")
    sys.exit(1)
elif warnings:
    print("\n⚠️ VALIDAÇÃO COM AVISOS - Revise os pontos indicados")
    sys.exit(0)
else:
    print("\n🎉 VALIDAÇÃO COMPLETA - Todas as correções aplicadas com sucesso!")
    print("\n📋 RESUMO DAS MELHORIAS:")
    print("   • Emojis do Trap (💎) e Brazilian Phonk (🇧🇷) corrigidos")
    print("   • Tamanho dos cards reduzido para caber no modal")
    print("   • Grid configurado para 4 colunas (desktop)")
    print("   • Altura do modal ajustada (85vh)")
    print("   • Responsividade adicionada (768px, 480px, 360px)")
    print("   • Botão Fechar visível e acessível")
    sys.exit(0)
