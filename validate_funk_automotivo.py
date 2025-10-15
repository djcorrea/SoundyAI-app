import json

file_path = r"c:\Users\DJ Correa\Desktop\Programação\SoundyAI\public\refs\out\funk_automotivo.json"

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("✅ JSON VÁLIDO\n")
    
    legacy = data["funk_automotivo"]["legacy_compatibility"]
    
    print("=== MÉTRICAS PRINCIPAIS ===")
    print(f"LUFS: {legacy['lufs_target']}")
    print(f"True Peak: {legacy['true_peak_target']}")
    print(f"DR: {legacy['dr_target']}")
    print(f"Stereo: {legacy['stereo_target']}")
    print(f"LRA: {legacy['lra_target']}")
    
    print("\n=== TOLERÂNCIAS ===")
    print(f"tol_lufs: {legacy['tol_lufs']}")
    print(f"tol_true_peak: {legacy['tol_true_peak']}")
    print(f"tol_dr: {legacy['tol_dr']}")
    print(f"tol_stereo: {legacy['tol_stereo']}")
    
    print("\n=== BANDAS (exemplos) ===")
    sub = legacy['bands']['sub']
    print(f"Sub: min={sub['target_range']['min']}, max={sub['target_range']['max']}, target={sub['target_db']}, tol_db={sub['tol_db']}")
    
    mid = legacy['bands']['mid']
    print(f"Mid: min={mid['target_range']['min']}, max={mid['target_range']['max']}, target={mid['target_db']}, tol_db={mid['tol_db']}")
    
    brilho = legacy['bands']['brilho']
    print(f"Brilho: min={brilho['target_range']['min']}, max={brilho['target_range']['max']}, target={brilho['target_db']}, tol_db={brilho['tol_db']}")
    
except Exception as e:
    print(f"❌ ERRO: {e}")
