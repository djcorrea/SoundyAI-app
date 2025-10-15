import json
import os
from pathlib import Path

# Definição dos novos valores para cada gênero
GENRE_UPDATES = {
    "funk_automotivo": {
        "lufs": -9.0, "true_peak": -0.25, "dr": 6.75, "stereo": 0.915, "rms": -12.0,
        "tol_lufs": 1.0, "tol_peak": 0.25, "tol_dr": 1.25, "tol_stereo": 0.065,
        "bands": {
            "sub": {"min": -29, "max": -23, "target": -26, "tol": 3},
            "low_bass": {"min": -29, "max": -23, "target": -26, "tol": 3},
            "upper_bass": {"min": -32, "max": -26, "target": -29, "tol": 3},
            "low_mid": {"min": -32, "max": -26, "target": -29, "tol": 3},
            "mid": {"min": -35, "max": -28, "target": -31.5, "tol": 3.5},
            "high_mid": {"min": -42, "max": -33, "target": -37.5, "tol": 4.5},
            "brilho": {"min": -48, "max": -38, "target": -43, "tol": 5},
            "presenca": {"min": -44, "max": -38, "target": -41, "tol": 3}
        }
    },
    "eletrofunk": {
        "lufs": -10.0, "true_peak": -0.25, "dr": 7.25, "stereo": 0.915, "rms": -13.0,
        "tol_lufs": 1.0, "tol_peak": 0.25, "tol_dr": 1.25, "tol_stereo": 0.065,
        "bands": {
            "sub": {"min": -29, "max": -23, "target": -26, "tol": 3},
            "low_bass": {"min": -30, "max": -24, "target": -27, "tol": 3},
            "upper_bass": {"min": -32, "max": -26, "target": -29, "tol": 3},
            "low_mid": {"min": -32, "max": -26, "target": -29, "tol": 3},
            "mid": {"min": -35, "max": -28, "target": -31.5, "tol": 3.5},
            "high_mid": {"min": -42, "max": -33, "target": -37.5, "tol": 4.5},
            "brilho": {"min": -48, "max": -38, "target": -43, "tol": 5},
            "presenca": {"min": -44, "max": -38, "target": -41, "tol": 3}
        }
    },
    "tech_house": {
        "lufs": -10.5, "true_peak": -0.65, "dr": 8.5, "stereo": 0.915, "rms": -13.5,
        "tol_lufs": 1.0, "tol_peak": 0.35, "tol_dr": 1.5, "tol_stereo": 0.065,
        "bands": {
            "sub": {"min": -32, "max": -25, "target": -28.5, "tol": 3.5},
            "low_bass": {"min": -31, "max": -25, "target": -28, "tol": 3},
            "upper_bass": {"min": -33, "max": -27, "target": -30, "tol": 3},
            "low_mid": {"min": -33, "max": -27, "target": -30, "tol": 3},
            "mid": {"min": -36, "max": -28, "target": -32, "tol": 4},
            "high_mid": {"min": -43, "max": -34, "target": -38.5, "tol": 4.5},
            "brilho": {"min": -46, "max": -36, "target": -41, "tol": 5},
            "presenca": {"min": -44, "max": -38, "target": -41, "tol": 3}
        }
    },
    "techno": {
        "lufs": -10.5, "true_peak": -0.65, "dr": 8.5, "stereo": 0.915, "rms": -13.5,
        "tol_lufs": 1.0, "tol_peak": 0.35, "tol_dr": 1.5, "tol_stereo": 0.065,
        "bands": {
            "sub": {"min": -32, "max": -25, "target": -28.5, "tol": 3.5},
            "low_bass": {"min": -31, "max": -25, "target": -28, "tol": 3},
            "upper_bass": {"min": -33, "max": -27, "target": -30, "tol": 3},
            "low_mid": {"min": -33, "max": -27, "target": -30, "tol": 3},
            "mid": {"min": -36, "max": -28, "target": -32, "tol": 4},
            "high_mid": {"min": -43, "max": -34, "target": -38.5, "tol": 4.5},
            "brilho": {"min": -46, "max": -36, "target": -41, "tol": 5},
            "presenca": {"min": -44, "max": -38, "target": -41, "tol": 3}
        }
    },
    "house": {
        "lufs": -10.5, "true_peak": -0.65, "dr": 8.5, "stereo": 0.915, "rms": -13.5,
        "tol_lufs": 1.0, "tol_peak": 0.35, "tol_dr": 1.5, "tol_stereo": 0.065,
        "bands": {
            "sub": {"min": -32, "max": -25, "target": -28.5, "tol": 3.5},
            "low_bass": {"min": -31, "max": -25, "target": -28, "tol": 3},
            "upper_bass": {"min": -33, "max": -27, "target": -30, "tol": 3},
            "low_mid": {"min": -33, "max": -27, "target": -30, "tol": 3},
            "mid": {"min": -36, "max": -28, "target": -32, "tol": 4},
            "high_mid": {"min": -43, "max": -34, "target": -38.5, "tol": 4.5},
            "brilho": {"min": -46, "max": -36, "target": -41, "tol": 5},
            "presenca": {"min": -44, "max": -38, "target": -41, "tol": 3}
        }
    },
    "trap": {
        "lufs": -10.5, "true_peak": -0.65, "dr": 10.0, "stereo": 0.875, "rms": -13.5,
        "tol_lufs": 1.5, "tol_peak": 0.35, "tol_dr": 2.0, "tol_stereo": 0.075,
        "bands": {
            "sub": {"min": -30, "max": -24, "target": -27, "tol": 3},
            "low_bass": {"min": -30, "max": -24, "target": -27, "tol": 3},
            "upper_bass": {"min": -32, "max": -26, "target": -29, "tol": 3},
            "low_mid": {"min": -32, "max": -26, "target": -29, "tol": 3},
            "mid": {"min": -35, "max": -28, "target": -31.5, "tol": 3.5},
            "high_mid": {"min": -43, "max": -34, "target": -38.5, "tol": 4.5},
            "brilho": {"min": -48, "max": -38, "target": -43, "tol": 5},
            "presenca": {"min": -44, "max": -38, "target": -41, "tol": 3}
        }
    },
    "trance": {
        "lufs": -10.5, "true_peak": -0.65, "dr": 10.5, "stereo": 0.915, "rms": -13.5,
        "tol_lufs": 1.5, "tol_peak": 0.35, "tol_dr": 1.5, "tol_stereo": 0.065,
        "bands": {
            "sub": {"min": -33, "max": -25, "target": -29, "tol": 4},
            "low_bass": {"min": -31, "max": -25, "target": -28, "tol": 3},
            "upper_bass": {"min": -34, "max": -28, "target": -31, "tol": 3},
            "low_mid": {"min": -34, "max": -28, "target": -31, "tol": 3},
            "mid": {"min": -36, "max": -28, "target": -32, "tol": 4},
            "high_mid": {"min": -43, "max": -34, "target": -38.5, "tol": 4.5},
            "brilho": {"min": -46, "max": -36, "target": -41, "tol": 5},
            "presenca": {"min": -44, "max": -38, "target": -41, "tol": 3}
        }
    },
    "brazilian_phonk": {
        "lufs": -9.0, "true_peak": -0.25, "dr": 7.0, "stereo": 0.915, "rms": -12.0,
        "tol_lufs": 1.0, "tol_peak": 0.25, "tol_dr": 1.0, "tol_stereo": 0.065,
        "bands": {
            "sub": {"min": -28, "max": -22, "target": -25, "tol": 3},
            "low_bass": {"min": -28, "max": -22, "target": -25, "tol": 3},
            "upper_bass": {"min": -31, "max": -25, "target": -28, "tol": 3},
            "low_mid": {"min": -31, "max": -25, "target": -28, "tol": 3},
            "mid": {"min": -35, "max": -28, "target": -31.5, "tol": 3.5},
            "high_mid": {"min": -42, "max": -33, "target": -37.5, "tol": 4.5},
            "brilho": {"min": -50, "max": -40, "target": -45, "tol": 5},
            "presenca": {"min": -46, "max": -40, "target": -43, "tol": 3}
        }
    },
    "phonk": {
        "lufs": -9.0, "true_peak": -0.25, "dr": 7.0, "stereo": 0.915, "rms": -12.0,
        "tol_lufs": 1.0, "tol_peak": 0.25, "tol_dr": 1.0, "tol_stereo": 0.065,
        "bands": {
            "sub": {"min": -28, "max": -22, "target": -25, "tol": 3},
            "low_bass": {"min": -28, "max": -22, "target": -25, "tol": 3},
            "upper_bass": {"min": -31, "max": -25, "target": -28, "tol": 3},
            "low_mid": {"min": -31, "max": -25, "target": -28, "tol": 3},
            "mid": {"min": -35, "max": -28, "target": -31.5, "tol": 3.5},
            "high_mid": {"min": -42, "max": -33, "target": -37.5, "tol": 4.5},
            "brilho": {"min": -50, "max": -40, "target": -45, "tol": 5},
            "presenca": {"min": -46, "max": -40, "target": -43, "tol": 3}
        }
    }
}

BASE_PATH = Path(r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\refs\out")

print("=" * 50)
print("  ATUALIZAÇÃO EM MASSA DE GÊNEROS MUSICAIS")
print("=" * 50)
print()

for genre_key, data in GENRE_UPDATES.items():
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
        
        # Atualizar original_metrics
        genre_data["hybrid_processing"]["original_metrics"]["lufs_integrated"] = data["lufs"]
        genre_data["hybrid_processing"]["original_metrics"]["true_peak_dbtp"] = data["true_peak"]
        genre_data["hybrid_processing"]["original_metrics"]["dynamic_range"] = data["dr"]
        genre_data["hybrid_processing"]["original_metrics"]["rms_db"] = data["rms"]
        genre_data["hybrid_processing"]["original_metrics"]["stereo_correlation"] = data["stereo"]
        
        # Atualizar legacy_compatibility
        genre_data["legacy_compatibility"]["lufs_target"] = data["lufs"]
        genre_data["legacy_compatibility"]["true_peak_target"] = data["true_peak"]
        genre_data["legacy_compatibility"]["dr_target"] = data["dr"]
        genre_data["legacy_compatibility"]["stereo_target"] = data["stereo"]
        genre_data["legacy_compatibility"]["tol_lufs"] = data["tol_lufs"]
        genre_data["legacy_compatibility"]["tol_true_peak"] = data["tol_peak"]
        genre_data["legacy_compatibility"]["tol_dr"] = data["tol_dr"]
        genre_data["legacy_compatibility"]["tol_stereo"] = data["tol_stereo"]
        
        # Atualizar bandas espectrais em spectral_bands
        for band_name, band_data in data["bands"].items():
            if band_name in genre_data["hybrid_processing"]["spectral_bands"]:
                genre_data["hybrid_processing"]["spectral_bands"][band_name]["target_range"] = {
                    "min": band_data["min"],
                    "max": band_data["max"]
                }
                genre_data["hybrid_processing"]["spectral_bands"][band_name]["target_db"] = band_data["target"]
                genre_data["hybrid_processing"]["spectral_bands"][band_name]["tol_db"] = band_data["tol"]
        
        # Atualizar bandas espectrais em legacy_compatibility.bands
        for band_name, band_data in data["bands"].items():
            if band_name in genre_data["legacy_compatibility"]["bands"]:
                genre_data["legacy_compatibility"]["bands"][band_name]["target_range"] = {
                    "min": band_data["min"],
                    "max": band_data["max"]
                }
                genre_data["legacy_compatibility"]["bands"][band_name]["target_db"] = band_data["target"]
                genre_data["legacy_compatibility"]["bands"][band_name]["tol_db"] = band_data["tol"]
        
        # Salvar JSON atualizado
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        print(f"   ✅ {genre_key}.json atualizado com sucesso!")
        
    except Exception as e:
        print(f"   ❌ ERRO ao atualizar {genre_key}.json: {e}")

print()
print("=" * 50)
print("  VALIDANDO TODOS OS ARQUIVOS")
print("=" * 50)
print()

all_valid = True
for genre_key in GENRE_UPDATES.keys():
    file_path = BASE_PATH / f"{genre_key}.json"
    
    if file_path.exists():
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                json.load(f)
            print(f"✅ {genre_key}.json - VÁLIDO")
        except Exception as e:
            print(f"❌ {genre_key}.json - INVÁLIDO: {e}")
            all_valid = False

print()
if all_valid:
    print("🎉 TODOS OS ARQUIVOS FORAM ATUALIZADOS E VALIDADOS COM SUCESSO!")
else:
    print("⚠️  ALGUNS ARQUIVOS APRESENTARAM ERROS. VERIFIQUE ACIMA.")
