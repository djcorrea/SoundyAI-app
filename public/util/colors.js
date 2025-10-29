/**
 * util/colors.js
 * 
 * Sistema centralizado de coloração para tabela de referência.
 * Garante que SEMPRE retorna uma classe válida, sem buracos nos limites.
 */

const EPS = 1e-6; // Epsilon para comparações float

/**
 * Calcula a classe de status para uma célula da tabela de referência.
 * 
 * GARANTIAS:
 * - SEMPRE retorna uma classe válida (nunca vazio/undefined)
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
 * @param {Object} params - Parâmetros de entrada
 * @param {number} params.value - Valor atual da métrica
 * @param {number} params.target - Valor alvo
 * @param {number} params.tol - Tolerância
 * @param {boolean} [params.bandMode=false] - Se true, usa lógica especial para bandas
 * @returns {string} StatusClass: 'ok' | 'yellow' | 'warn' | 'orange' | 'no-data'
 */
export function getStatusClass({ value, target, tol, bandMode = false }) {
    // 1. Validar dados de entrada
    if (!Number.isFinite(value) || !Number.isFinite(target)) {
        return 'no-data'; // Dados inválidos → sem cor especial
    }
    
    // 2. Calcular diferença absoluta
    const diff = value - target;
    const absDiff = Math.abs(diff);
    
    // 3. Modo Bandas (tol=0 ou bandMode=true)
    if (bandMode || (Number.isFinite(tol) && Math.abs(tol) < EPS)) {
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
    
    // 4. Validar tolerância (usar fallback se inválida)
    let effectiveTol;
    if (Number.isFinite(tol) && tol > 0) {
        effectiveTol = tol;
    } else {
        effectiveTol = 1.0; // Fallback padrão
    }
    
    // 5. Modo Padrão (métricas principais: LUFS, TP, DR, etc.)
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
 * @param {string} statusClass - Classe de status
 * @returns {string} Descrição textual
 */
export function getStatusText(statusClass) {
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
 * @param {any} value - Valor a validar
 * @returns {boolean} True se for número finito
 */
export function isValidNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

// Para uso sem módulos
if (typeof window !== 'undefined') {
    window.RefColors = {
        getStatusClass,
        getStatusText,
        isValidNumber
    };
}
