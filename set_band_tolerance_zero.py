import json
from pathlib import Path

# Lista de gêneros para atualizar
GENRES = [
    "funk_bruxaria",
    "funk_automotivo",
    "eletrofunk",
    "tech_house",
    "techno",
    "house",
    "trap",
    "trance",
    "brazilian_phonk",
    "phonk"
]

BASE_PATH = Path(r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\refs\out")

print("=" * 60)
print("  ZERANDO TOLERÂNCIAS DE BANDAS ESPECTRAIS (tol_db = 0)")
print("=" * 60)
print()

for genre_key in GENRES:
    file_path = BASE_PATH / f"{genre_key}.json"
    
    if not file_path.exists():
        print(f"❌ Arquivo não encontrado: {genre_key}.json")
        continue
    
    print(f"🔄 Atualizando {genre_key}.json...")
    
    try:
        # Ler JSON
        with open(file_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        genre_data = json_data[genre_key]
        
        # Zerar tol_db em spectral_bands
        for band_name, band_data in genre_data["hybrid_processing"]["spectral_bands"].items():
            if "tol_db" in band_data:
                band_data["tol_db"] = 0
        
        # Zerar tol_db em legacy_compatibility.bands
        for band_name, band_data in genre_data["legacy_compatibility"]["bands"].items():
            if "tol_db" in band_data:
                band_data["tol_db"] = 0
        
        # Salvar JSON atualizado
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        print(f"   ✅ {genre_key}.json - tol_db = 0 em todas as bandas!")
        
    except Exception as e:
        print(f"   ❌ ERRO ao atualizar {genre_key}.json: {e}")

print()
print("=" * 60)
print("  VALIDANDO TODOS OS ARQUIVOS")
print("=" * 60)
print()

all_valid = True
for genre_key in GENRES:
    file_path = BASE_PATH / f"{genre_key}.json"
    
    if file_path.exists():
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
                
            # Verificar se todas as bandas têm tol_db = 0
            genre_data = json_data[genre_key]
            bands_ok = True
            
            for band_name, band_data in genre_data["legacy_compatibility"]["bands"].items():
                if band_data.get("tol_db") != 0:
                    bands_ok = False
                    break
            
            if bands_ok:
                print(f"✅ {genre_key}.json - VÁLIDO (tol_db = 0 em todas as bandas)")
            else:
                print(f"⚠️  {genre_key}.json - Ainda tem tol_db != 0")
                all_valid = False
                
        except Exception as e:
            print(f"❌ {genre_key}.json - INVÁLIDO: {e}")
            all_valid = False

print()
if all_valid:
    print("🎉 TODOS OS ARQUIVOS FORAM ATUALIZADOS COM SUCESSO!")
    print("📊 Todas as tolerâncias de bandas (tol_db) agora são 0")
else:
    print("⚠️  ALGUNS ARQUIVOS APRESENTARAM PROBLEMAS. VERIFIQUE ACIMA.")
