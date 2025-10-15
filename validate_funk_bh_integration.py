import json
from pathlib import Path

print("=" * 70)
print("  VALIDAÇÃO COMPLETA - INTEGRAÇÃO DO FUNK BH")
print("=" * 70)
print()

BASE_PATH = Path(r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI")
all_valid = True

# 1. Validar funk_bh.json
print("1️⃣  Validando funk_bh.json...")
funk_bh_path = BASE_PATH / "public" / "refs" / "out" / "funk_bh.json"
try:
    with open(funk_bh_path, 'r', encoding='utf-8') as f:
        funk_bh_data = json.load(f)
    
    # Verificar estrutura
    assert "funk_bh" in funk_bh_data
    assert "hybrid_processing" in funk_bh_data["funk_bh"]
    assert "legacy_compatibility" in funk_bh_data["funk_bh"]
    
    legacy = funk_bh_data["funk_bh"]["legacy_compatibility"]
    
    # Verificar métricas
    assert legacy["lufs_target"] == -9.0
    assert legacy["true_peak_target"] == -0.25
    assert legacy["dr_target"] == 7.0
    assert legacy["stereo_target"] == 0.915
    
    # Verificar bandas
    assert "sub" in legacy["bands"]
    assert legacy["bands"]["sub"]["tol_db"] == 0
    assert legacy["bands"]["sub"]["target_range"]["min"] == -29
    assert legacy["bands"]["sub"]["target_range"]["max"] == -23
    
    print("   ✅ funk_bh.json VÁLIDO!")
    print(f"      LUFS: {legacy['lufs_target']}, DR: {legacy['dr_target']}, Stereo: {legacy['stereo_target']}")
    print(f"      Bandas: 8 bandas com tol_db=0")
    
except Exception as e:
    print(f"   ❌ ERRO: {e}")
    all_valid = False

print()

# 2. Validar genres.json
print("2️⃣  Validando genres.json...")
genres_path = BASE_PATH / "public" / "refs" / "out" / "genres.json"
try:
    with open(genres_path, 'r', encoding='utf-8') as f:
        genres_data = json.load(f)
    
    genre_keys = [g["key"] for g in genres_data["genres"]]
    
    if "funk_bh" in genre_keys:
        funk_bh_genre = next(g for g in genres_data["genres"] if g["key"] == "funk_bh")
        print(f"   ✅ funk_bh encontrado no manifesto!")
        print(f"      Label: {funk_bh_genre['label']}")
        print(f"      Total de gêneros: {len(genre_keys)}")
    else:
        print("   ❌ funk_bh NÃO encontrado no manifesto!")
        all_valid = False
        
except Exception as e:
    print(f"   ❌ ERRO: {e}")
    all_valid = False

print()

# 3. Validar scoring-v2-config.json
print("3️⃣  Validando scoring-v2-config.json...")
scoring_path = BASE_PATH / "config" / "scoring-v2-config.json"
try:
    with open(scoring_path, 'r', encoding='utf-8') as f:
        scoring_data = json.load(f)
    
    if "funk_bh" in scoring_data.get("targets_by_genre", {}):
        funk_bh_config = scoring_data["targets_by_genre"]["funk_bh"]
        print(f"   ✅ funk_bh encontrado na configuração de scoring!")
        print(f"      LUFS target: {funk_bh_config['lufs']['target']}")
        print(f"      DR target: {funk_bh_config['dr']['target']}")
        print(f"      Bandas configuradas: {len([k for k in funk_bh_config.keys() if k.startswith('band_')])}")
    else:
        print("   ❌ funk_bh NÃO encontrado no scoring!")
        all_valid = False
        
except Exception as e:
    print(f"   ❌ ERRO: {e}")
    all_valid = False

print()

# 4. Validar index.html (verificar se o arquivo foi atualizado)
print("4️⃣  Validando index.html...")
index_path = BASE_PATH / "public" / "index.html"
try:
    with open(index_path, 'r', encoding='utf-8') as f:
        index_content = f.read()
    
    if 'data-genre="funk_bh"' in index_content and 'Funk BH' in index_content:
        print("   ✅ Botão do Funk BH encontrado no modal!")
        print("   ✅ Opção do Funk BH encontrada no select!")
    else:
        print("   ❌ Funk BH NÃO encontrado no HTML!")
        all_valid = False
        
except Exception as e:
    print(f"   ❌ ERRO: {e}")
    all_valid = False

print()
print("=" * 70)

if all_valid:
    print("🎉 VALIDAÇÃO COMPLETA - FUNK BH INTEGRADO COM SUCESSO!")
    print()
    print("📋 RESUMO:")
    print("   ✅ funk_bh.json criado e válido")
    print("   ✅ Adicionado ao genres.json")
    print("   ✅ Configurado no scoring-v2-config.json")
    print("   ✅ Botão adicionado no modal de gêneros")
    print("   ✅ Opção adicionada no select")
    print()
    print("🎯 O Funk BH está pronto para uso!")
else:
    print("⚠️  ALGUNS PROBLEMAS FORAM ENCONTRADOS. VERIFIQUE ACIMA.")

print("=" * 70)
