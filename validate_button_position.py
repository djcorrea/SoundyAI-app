#!/usr/bin/env python3
"""
Valida se o botão Fechar foi ajustado corretamente
"""

import re

def validate_button_changes():
    print("\n🔍 VALIDANDO AJUSTES DO BOTÃO FECHAR...\n")
    
    # Ler CSS
    with open('public/audio-analyzer.css', 'r', encoding='utf-8') as f:
        css_content = f.read()
    
    # Ler HTML
    with open('public/index.html', 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Verificar CSS
    pattern = r'#audioAnalysisModal\s+\.audio-close-bottom\s*\{[^}]*?margin:\s*(\d+)px\s+auto\s+0\s+auto\s*!important[^}]*?padding:\s*(\d+)px\s+(\d+)px[^}]*?height:\s*(\d+)px[^}]*?font-size:\s*([\d.]+)rem[^}]*?\}'
    match = re.search(pattern, css_content, re.DOTALL)
    
    checks = []
    
    if match:
        margin_top = int(match.group(1))
        padding_v = int(match.group(2))
        padding_h = int(match.group(3))
        height = int(match.group(4))
        font_size = float(match.group(5))
        
        print("📊 Valores encontrados no CSS:")
        print(f"   • margin-top: {margin_top}px {'✅' if margin_top == 32 else '❌'}")
        print(f"   • padding: {padding_v}px {padding_h}px {'✅' if padding_v == 6 and padding_h == 20 else '❌'}")
        print(f"   • height: {height}px {'✅' if height == 34 else '❌'}")
        print(f"   • font-size: {font_size}rem {'✅' if font_size == 0.85 else '❌'}")
        print(f"   • !important usado: ✅")
        
        checks.append(margin_top == 32)
        checks.append(padding_v == 6 and padding_h == 20)
        checks.append(height == 34)
        checks.append(font_size == 0.85)
    else:
        print("❌ Não encontrou o CSS do botão!")
        checks.append(False)
    
    # Verificar se não tem estilo inline no HTML
    inline_style = re.search(r'class="audio-close-bottom"[^>]*style=', html_content)
    if inline_style:
        print("\n❌ ATENÇÃO: Ainda existe estilo inline no HTML!")
        checks.append(False)
    else:
        print("\n✅ HTML limpo (sem estilos inline)")
        checks.append(True)
    
    print("\n" + "="*60)
    if all(checks):
        print("🎉 BOTÃO AJUSTADO CORRETAMENTE!")
        print("\n📋 Resumo:")
        print("   • Tamanho reduzido (padding 6px, height 34px)")
        print("   • Texto menor (0.85rem)")
        print("   • Posição elevada (margin-top 32px)")
        print("   • !important forçando a mudança")
        print("\n💡 Limpe o cache do navegador:")
        print("   → Ctrl+Shift+Delete (limpar cache)")
        print("   → Ctrl+Shift+R (recarregar página)")
        print("   → F12 > Network > Disable cache")
    else:
        print("❌ ALGUNS AJUSTES FALTANDO!")
    print("="*60)

if __name__ == "__main__":
    validate_button_changes()
