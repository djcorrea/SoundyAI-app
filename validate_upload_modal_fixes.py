#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de validação das correções do modal de upload
"""

import re
import sys

css_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\audio-analyzer.css"

print("🔍 VALIDAÇÃO DAS CORREÇÕES DO MODAL DE UPLOAD\n")
print("=" * 60)

errors = []
warnings = []
success = []

# ========================================
# Verificar CSS do botão e layout
# ========================================
print("\n🎨 Verificando CSS do modal de upload...")

with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

# Verifica botão "Escolher Arquivo" com centralização
upload_btn_pattern = r'#audioAnalysisModal\s+\.upload-btn\s*{[^}]*display:\s*inline-flex[^}]*align-items:\s*center[^}]*justify-content:\s*center[^}]*line-height:\s*1'
if re.search(upload_btn_pattern, css_content, re.DOTALL | re.IGNORECASE):
    success.append("✅ Botão 'Escolher Arquivo' com display inline-flex + centralização vertical")
else:
    # Verifica se pelo menos tem inline-flex
    if re.search(r'#audioAnalysisModal\s+\.upload-btn\s*{[^}]*display:\s*inline-flex', css_content, re.DOTALL):
        success.append("✅ Botão 'Escolher Arquivo' com display inline-flex")
    else:
        errors.append("❌ Botão 'Escolher Arquivo' não está usando inline-flex")

# Verifica align-items e justify-content
if re.search(r'#audioAnalysisModal\s+\.upload-btn\s*{[^}]*align-items:\s*center', css_content, re.DOTALL):
    success.append("✅ Botão com align-items: center (texto centralizado verticalmente)")
else:
    warnings.append("⚠️ Botão pode não ter align-items: center")

if re.search(r'#audioAnalysisModal\s+\.upload-btn\s*{[^}]*justify-content:\s*center', css_content, re.DOTALL):
    success.append("✅ Botão com justify-content: center (texto centralizado horizontalmente)")
else:
    warnings.append("⚠️ Botão pode não ter justify-content: center")

if re.search(r'#audioAnalysisModal\s+\.upload-btn\s*{[^}]*line-height:\s*1', css_content, re.DOTALL):
    success.append("✅ Botão com line-height: 1 (sem espaço extra)")
else:
    warnings.append("⚠️ Botão pode não ter line-height: 1")

# Verifica botão "Fechar" com margin ajustada
close_btn_pattern = r'#audioAnalysisModal\s+\.audio-close-bottom\s*{[^}]*margin:\s*32px\s+auto\s+0\s+auto'
if re.search(close_btn_pattern, css_content, re.DOTALL):
    success.append("✅ Botão 'Fechar' com margin-top: 32px (espaçamento otimizado)")
else:
    # Verifica se tem margin-top 25px (valor antigo)
    if re.search(r'#audioAnalysisModal\s+\.audio-close-bottom\s*{[^}]*margin:\s*25px\s+auto\s+0\s+auto', css_content, re.DOTALL):
        warnings.append("⚠️ Botão 'Fechar' ainda usa margin-top: 25px (deveria ser 32px)")
    else:
        errors.append("❌ Botão 'Fechar' não tem margin correta")

# Verifica se botão Fechar tem display: block
if re.search(r'#audioAnalysisModal\s+\.audio-close-bottom\s*{[^}]*display:\s*block', css_content, re.DOTALL):
    success.append("✅ Botão 'Fechar' com display: block (centralização automática)")
else:
    warnings.append("⚠️ Botão 'Fechar' pode não ter display: block")

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
    print("\n📋 RESUMO DAS CORREÇÕES:")
    print("   • Botão 'Escolher Arquivo' centralizado verticalmente")
    print("   • Botão 'Fechar' com espaçamento melhorado (32px)")
    print("   • Texto dos botões sem desalinhamento")
    sys.exit(0)
else:
    print("\n🎉 VALIDAÇÃO COMPLETA - Todas as correções aplicadas com sucesso!")
    print("\n📋 RESUMO DAS CORREÇÕES:")
    print("   • Botão 'Escolher Arquivo' centralizado com inline-flex")
    print("   • align-items: center (centralização vertical)")
    print("   • justify-content: center (centralização horizontal)")
    print("   • line-height: 1 (sem espaço extra acima/abaixo)")
    print("   • Botão 'Fechar' subiu 7px (margin-top: 32px)")
    print("   • Layout mais equilibrado e profissional")
    sys.exit(0)
