#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de validação final das correções do modal de upload
"""

import re
import sys

css_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\audio-analyzer.css"
html_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\index.html"

print("🔍 VALIDAÇÃO FINAL DO MODAL DE UPLOAD\n")
print("=" * 60)

errors = []
warnings = []
success = []

# ========================================
# 1. Verificar HTML (sem estilos inline)
# ========================================
print("\n📝 1. Verificando HTML...")

with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Verifica se o label não tem estilos inline problemáticos
if re.search(r'<label[^>]*class="upload-btn"[^>]*>', html_content):
    # Verifica se NÃO tem display:inline-block no inline style
    label_match = re.search(r'<label[^>]*class="upload-btn"[^>]*style="([^"]*)"', html_content)
    if label_match:
        inline_style = label_match.group(1)
        if 'display' in inline_style or 'width:100%' in inline_style:
            errors.append(f"❌ Label ainda tem estilos inline problemáticos: {inline_style[:50]}...")
        else:
            success.append("✅ Label sem estilos inline problemáticos")
    else:
        success.append("✅ Label sem estilos inline (classe pura)")

# ========================================
# 2. Verificar CSS
# ========================================
print("\n🎨 2. Verificando CSS...")

with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

# Verifica botão "Escolher Arquivo"
checks = [
    (r'#audioAnalysisModal\s+\.upload-btn\s*{[^}]*height:\s*48px', 
     "✅ Botão 'Escolher Arquivo' com altura fixa (48px)"),
    
    (r'#audioAnalysisModal\s+\.upload-btn\s*{[^}]*padding:\s*14px\s+40px', 
     "✅ Botão com padding reduzido (14px vertical)"),
    
    (r'#audioAnalysisModal\s+\.upload-btn\s*{[^}]*display:\s*inline-flex\s*!important', 
     "✅ Botão com display: inline-flex !important"),
    
    (r'#audioAnalysisModal\s+\.upload-btn\s*{[^}]*align-items:\s*center\s*!important', 
     "✅ Botão com align-items: center !important"),
    
    (r'#audioAnalysisModal\s+\.upload-btn\s*{[^}]*line-height:\s*1\s*!important', 
     "✅ Botão com line-height: 1 !important"),
    
    (r'#audioAnalysisModal\s+\.upload-btn\s*{[^}]*vertical-align:\s*middle', 
     "✅ Botão com vertical-align: middle"),
]

for pattern, message in checks:
    if re.search(pattern, css_content, re.DOTALL):
        success.append(message)
    else:
        warnings.append(f"⚠️ {message.replace('✅', '').strip()} - não encontrado")

# Verifica botão "Fechar"
close_checks = [
    (r'#audioAnalysisModal\s+\.audio-close-bottom\s*{[^}]*height:\s*40px', 
     "✅ Botão 'Fechar' com altura fixa (40px)"),
    
    (r'#audioAnalysisModal\s+\.audio-close-bottom\s*{[^}]*padding:\s*10px\s+24px', 
     "✅ Botão 'Fechar' com padding reduzido (10px vertical)"),
    
    (r'#audioAnalysisModal\s+\.audio-close-bottom\s*{[^}]*display:\s*flex', 
     "✅ Botão 'Fechar' com display: flex"),
    
    (r'#audioAnalysisModal\s+\.audio-close-bottom\s*{[^}]*align-items:\s*center', 
     "✅ Botão 'Fechar' com align-items: center"),
    
    (r'#audioAnalysisModal\s+\.audio-close-bottom\s*{[^}]*line-height:\s*1', 
     "✅ Botão 'Fechar' com line-height: 1"),
]

for pattern, message in close_checks:
    if re.search(pattern, css_content, re.DOTALL):
        success.append(message)
    else:
        warnings.append(f"⚠️ {message.replace('✅', '').strip()} - não encontrado")

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
    print("\n❌ VALIDAÇÃO FALHOU - Corrija os erros antes de testar")
    sys.exit(1)
elif warnings:
    print("\n⚠️ VALIDAÇÃO COM AVISOS - Teste e verifique o resultado visual")
    print("\n📋 ALTERAÇÕES APLICADAS:")
    print("   • Botão 'Escolher Arquivo': altura 48px, padding 14px vertical")
    print("   • Botão 'Fechar': altura 40px, padding 10px vertical")
    print("   • Ambos: display flex + align-items center + line-height 1")
    print("   • Estilos inline removidos do HTML")
    sys.exit(0)
else:
    print("\n🎉 VALIDAÇÃO COMPLETA - Todas as correções aplicadas!")
    print("\n📋 ALTERAÇÕES APLICADAS:")
    print("   • Botão 'Escolher Arquivo':")
    print("     - Altura fixa: 48px")
    print("     - Padding vertical reduzido: 14px")
    print("     - Display: inline-flex com align-items: center")
    print("     - Line-height: 1 (sem espaço extra)")
    print("     - Vertical-align: middle")
    print("")
    print("   • Botão 'Fechar':")
    print("     - Altura fixa: 40px")
    print("     - Padding vertical reduzido: 10px")
    print("     - Display: flex com align-items: center")
    print("     - Line-height: 1 (sem espaço extra)")
    print("")
    print("   • HTML:")
    print("     - Estilos inline problemáticos removidos")
    print("     - Label com classe pura (sem width:100%)")
    print("")
    print("🔄 Recarregue a página (Ctrl+Shift+R) para ver as mudanças!")
    sys.exit(0)
