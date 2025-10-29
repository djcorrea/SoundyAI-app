/**
 * util/ref.ts
 * 
 * Helpers para acessar targets e tolerâncias dos perfis de referência.
 * Garante coerção numérica e validação de positivos.
 */

/**
 * Resultado da busca por target/tolerância
 */
export interface TargetTolResult {
    target: number | null;
    tol: number | null;
}

/**
 * Perfil de referência (estrutura simplificada)
 */
export interface ReferenceProfile {
    [key: string]: any;
    bands?: {
        [bandKey: string]: {
            min?: number;
            max?: number;
            target_db?: number;
            tol_db?: number;
        };
    };
}

/**
 * Mapeamento de métricas para campos no perfil de referência
 */
const METRIC_KEY_MAP: Record<string, { targetKey: string; tolKey: string }> = {
    'lufs': { targetKey: 'lufs_target', tolKey: 'tol_lufs' },
    'lufs_integrated': { targetKey: 'lufs_target', tolKey: 'tol_lufs' },
    'true_peak': { targetKey: 'true_peak_target', tolKey: 'tol_true_peak' },
    'true_peak_dbtp': { targetKey: 'true_peak_target', tolKey: 'tol_true_peak' },
    'dr': { targetKey: 'dr_target', tolKey: 'tol_dr' },
    'dynamic_range': { targetKey: 'dr_target', tolKey: 'tol_dr' },
    'lra': { targetKey: 'lra_target', tolKey: 'tol_lra' },
    'stereo': { targetKey: 'stereo_target', tolKey: 'tol_stereo' },
    'stereo_correlation': { targetKey: 'stereo_target', tolKey: 'tol_stereo' }
};

/**
 * Obtém target e tolerância para uma métrica específica do perfil de referência.
 * 
 * GARANTIAS:
 * - Sempre retorna objeto { target, tol } (nunca undefined)
 * - Valores inválidos são convertidos para null
 * - Coerção numérica automática com Number(...)
 * - Validação de positivos (tolerância deve ser >= 0)
 * 
 * @param refProfile - Perfil de referência do gênero
 * @param metricKey - Chave da métrica (ex: 'lufs', 'true_peak', 'dr')
 * @returns { target, tol } com valores numéricos ou null
 */
export function getMetricTargetTol(
    refProfile: ReferenceProfile | null | undefined,
    metricKey: string
): TargetTolResult {
    // 1. Inicializar resultado padrão
    const result: TargetTolResult = {
        target: null,
        tol: null
    };
    
    // 2. Validar perfil
    if (!refProfile || typeof refProfile !== 'object') {
        return result;
    }
    
    // 3. Obter mapeamento de chaves
    const mapping = METRIC_KEY_MAP[metricKey.toLowerCase()];
    if (!mapping) {
        // Métrica não mapeada - retornar nulo
        return result;
    }
    
    // 4. Extrair target
    const rawTarget = refProfile[mapping.targetKey];
    if (rawTarget != null) {
        const numTarget = Number(rawTarget);
        if (Number.isFinite(numTarget)) {
            result.target = numTarget;
        }
    }
    
    // 5. Extrair tolerância
    const rawTol = refProfile[mapping.tolKey];
    if (rawTol != null) {
        const numTol = Number(rawTol);
        // Validar que tolerância é não-negativa
        if (Number.isFinite(numTol) && numTol >= 0) {
            result.tol = numTol;
        }
    }
    
    return result;
}

/**
 * Obtém target e tolerância para uma banda espectral.
 * 
 * Para bandas, o target pode ser:
 * - Um range { min, max } → retorna middle point e tol=0
 * - Um valor fixo { target_db, tol_db }
 * 
 * @param refProfile - Perfil de referência
 * @param bandKey - Chave da banda (ex: 'sub', 'bass', 'mid')
 * @returns { target, tol } ou null se banda não existe
 */
export function getBandTargetTol(
    refProfile: ReferenceProfile | null | undefined,
    bandKey: string
): TargetTolResult {
    const result: TargetTolResult = {
        target: null,
        tol: null
    };
    
    // 1. Validar perfil e existência de bandas
    if (!refProfile?.bands || typeof refProfile.bands !== 'object') {
        return result;
    }
    
    // 2. Normalizar chave da banda (lowercase, sem espaços)
    const normalizedKey = bandKey.toLowerCase().replace(/\s+/g, '_');
    
    // 3. Buscar banda (tentar várias variações)
    const bandData = 
        refProfile.bands[normalizedKey] || 
        refProfile.bands[bandKey] ||
        refProfile.bands[bandKey.toLowerCase()];
    
    if (!bandData || typeof bandData !== 'object') {
        return result;
    }
    
    // 4. Modo Range: { min, max }
    if (
        bandData.min != null && 
        bandData.max != null &&
        Number.isFinite(Number(bandData.min)) &&
        Number.isFinite(Number(bandData.max))
    ) {
        const min = Number(bandData.min);
        const max = Number(bandData.max);
        
        // Target = ponto médio do range
        result.target = (min + max) / 2;
        
        // Tolerância = 0 (usa lógica de bandMode)
        result.tol = 0;
        
        return result;
    }
    
    // 5. Modo Fixo: { target_db, tol_db }
    if (bandData.target_db != null) {
        const numTarget = Number(bandData.target_db);
        if (Number.isFinite(numTarget)) {
            result.target = numTarget;
        }
    }
    
    if (bandData.tol_db != null) {
        const numTol = Number(bandData.tol_db);
        if (Number.isFinite(numTol) && numTol >= 0) {
            result.tol = numTol;
        }
    }
    
    return result;
}

/**
 * Valida se um perfil de referência tem dados mínimos necessários
 */
export function isValidReferenceProfile(refProfile: any): refProfile is ReferenceProfile {
    if (!refProfile || typeof refProfile !== 'object') {
        return false;
    }
    
    // Pelo menos uma métrica principal deve existir
    const hasLufs = refProfile.lufs_target != null;
    const hasTruePeak = refProfile.true_peak_target != null;
    const hasDR = refProfile.dr_target != null;
    
    return hasLufs || hasTruePeak || hasDR;
}
