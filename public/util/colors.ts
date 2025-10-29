/**
 * util/colors.ts
 * 
 * Sistema centralizado de coloração para tabela de referência.
 * Garante que SEMPRE retorna uma classe válida, sem buracos nos limites.
 */

const EPS = 1e-6; // Epsilon para comparações float

/**
 * Status classes disponíveis para células da tabela
 */
export type StatusClass = 'ok' | 'yellow' | 'warn' | 'orange' | 'no-data';

/**
 * Parâmetros para cálculo de status
 */
export interface StatusParams {
    value: number | null | undefined;
    target: number | null | undefined;
    tol: number | null | undefined;
    bandMode?: boolean; // Se true, usa lógica especial para bandas (4 níveis)
}

/**
 * Calcula a classe de status para uma célula da tabela de referência.
 * 
 * GARANTIAS:
 * - SEMPRE retorna uma StatusClass válida (nunca vazio/undefined)
 * - Limites são inclusivos (sem buracos matemáticos)
 * - Dados inválidos retornam 'no-data'
 * 
 * REGRAS (modo padrão):
 * - absDiff <= tol → 'ok' (verde)
 * - tol < absDiff <= 2*tol → 'yellow' (amarelo)
 * - absDiff > 2*tol → 'warn' (vermelho)
 * 
 * REGRAS (bandMode=true):
 * - absDiff === 0 → 'ok' (dentro do range)
 * - 0 < absDiff <= 1.0 → 'yellow' (fora por até 1dB)
 * - 1.0 < absDiff <= 3.0 → 'orange' (fora por até 3dB)
 * - absDiff > 3.0 → 'warn' (fora por >3dB)
 * 
 * @param params - Parâmetros de entrada
 * @returns StatusClass válida (nunca undefined)
 */
export function getStatusClass(params: StatusParams): StatusClass {
    const { value, target, tol, bandMode = false } = params;
    
    // 1. Validar dados de entrada
    if (!Number.isFinite(value) || !Number.isFinite(target)) {
        return 'no-data'; // Dados inválidos → sem cor especial
    }
    
    // 2. Type narrowing: após validação, value e target são numbers
    const numValue = value as number;
    const numTarget = target as number;
    
    // 3. Calcular diferença absoluta
    const diff = numValue - numTarget;
    const absDiff = Math.abs(diff);
    
    // 4. Modo Bandas (tol=0 ou bandMode=true)
    if (bandMode || (Number.isFinite(tol) && tol != null && Math.abs(tol) < EPS)) {
        // Lógica binária de 4 níveis para bandas espectrais
        if (absDiff < EPS) {
            return 'ok'; // Dentro do range (diff ≈ 0)
        } else if (absDiff <= 1.0 + EPS) {
            return 'yellow'; // Fora por até 1dB
        } else if (absDiff <= 3.0 + EPS) {
            return 'orange'; // Fora por até 3dB
        } else {
            return 'warn'; // Fora por >3dB
        }
    }
    
    // 5. Validar tolerância (usar fallback se inválida)
    let effectiveTol: number;
    if (Number.isFinite(tol) && tol != null && tol > 0) {
        effectiveTol = tol;
    } else {
        effectiveTol = 1.0; // Fallback padrão
    }
    
    // 6. Modo Padrão (métricas principais: LUFS, TP, DR, etc.)
    // LIMITES INCLUSIVOS (sem buracos):
    if (absDiff <= effectiveTol + EPS) {
        return 'ok'; // Zona ideal
    } else if (absDiff <= 2 * effectiveTol + EPS) {
        return 'yellow'; // Zona ajuste leve
    } else {
        return 'warn'; // Zona corrigir
    }
}

/**
 * Retorna a descrição textual do status
 */
export function getStatusText(statusClass: StatusClass): string {
    switch (statusClass) {
        case 'ok':
            return 'Ideal';
        case 'yellow':
            return 'Ajuste leve';
        case 'orange':
            return 'Ajustar';
        case 'warn':
            return 'Corrigir';
        case 'no-data':
            return 'Sem dados';
        default:
            return 'Sem dados';
    }
}

/**
 * Valida se um valor é numérico finito
 */
export function isValidNumber(value: any): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}
