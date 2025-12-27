#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 VALIDATE-GENRE-TARGETS.CJS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Script de validação completa dos JSONs de targets de gênero.
 * 
 * VALIDAÇÕES:
 * 1. ✅ true_peak_max NUNCA > 0 dBTP (regra absoluta)
 * 2. ✅ Campos min/max consistentes (min < max, min < target < max)
 * 3. ✅ Estrutura obrigatória presente
 * 4. ✅ Valores dentro de ranges plausíveis
 * 5. ✅ Sincronização entre work/ e public/
 * 
 * USAGE:
 *   node scripts/validate-genre-targets.cjs
 *   npm run validate:targets
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

const WORK_DIR = path.join(__dirname, '..', 'work', 'refs', 'out');
const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'refs', 'out');

// Campos obrigatórios em nível raiz
const REQUIRED_ROOT_FIELDS = [
    'lufs_target',
    'true_peak_target',
    'dr_target',
    'tol_lufs',
    'tol_true_peak',
    'tol_dr'
];

// Campos min/max esperados
const MINMAX_PAIRS = [
    { min: 'lufs_min', max: 'lufs_max', target: 'lufs_target' },
    { min: 'true_peak_min', max: 'true_peak_max', target: 'true_peak_target' },
    { min: 'dr_min', max: 'dr_max', target: 'dr_target' }
];

// Ranges plausíveis para validação
const PLAUSIBLE_RANGES = {
    lufs_target: { min: -20, max: -3 },
    lufs_min: { min: -25, max: -5 },
    lufs_max: { min: -15, max: 0 },
    true_peak_target: { min: -3, max: 0 },
    true_peak_min: { min: -5, max: -0.5 },
    true_peak_max: { min: -Infinity, max: 0.0 }, // NUNCA > 0
    dr_target: { min: 3, max: 15 },
    dr_min: { min: 2, max: 12 },
    dr_max: { min: 5, max: 20 },
    tol_lufs: { min: 0.5, max: 5 },
    tol_true_peak: { min: 0.1, max: 2 },
    tol_dr: { min: 0.5, max: 3 }
};

// ═══════════════════════════════════════════════════════════════════════════
// 📊 VALIDADORES
// ═══════════════════════════════════════════════════════════════════════════

const errors = [];
const warnings = [];
let filesChecked = 0;
let filesValid = 0;

function logError(file, message) {
    errors.push({ file, message });
    console.error(`  ❌ ${message}`);
}

function logWarning(file, message) {
    warnings.push({ file, message });
    console.warn(`  ⚠️  ${message}`);
}

function logOk(message) {
    console.log(`  ✅ ${message}`);
}

/**
 * Valida que true_peak_max NUNCA > 0 (regra absoluta)
 */
function validateTruePeakMax(data, file, prefix = '') {
    const checkPath = (obj, path) => {
        if (!obj) return;
        
        // Verificar true_peak_max
        if ('true_peak_max' in obj) {
            if (obj.true_peak_max > 0) {
                logError(file, `${prefix}true_peak_max = ${obj.true_peak_max} > 0 dBTP (VIOLAÇÃO CRÍTICA!)`);
                return false;
            }
        }
        
        // Recursivamente verificar nested objects
        if (obj.legacy_compatibility) {
            checkPath(obj.legacy_compatibility, `${prefix}legacy_compatibility.`);
        }
        if (obj.hybrid_processing) {
            checkPath(obj.hybrid_processing, `${prefix}hybrid_processing.`);
        }
        
        return true;
    };
    
    return checkPath(data, prefix);
}

/**
 * Valida consistência de min/max/target
 */
function validateMinMaxConsistency(data, file) {
    let valid = true;
    
    MINMAX_PAIRS.forEach(pair => {
        const minVal = data[pair.min];
        const maxVal = data[pair.max];
        const targetVal = data[pair.target];
        
        // Se min/max existem, validar consistência
        if (Number.isFinite(minVal) && Number.isFinite(maxVal)) {
            if (minVal >= maxVal) {
                logError(file, `${pair.min} (${minVal}) >= ${pair.max} (${maxVal})`);
                valid = false;
            }
            
            // Target deve estar entre min e max
            if (Number.isFinite(targetVal)) {
                if (targetVal < minVal || targetVal > maxVal) {
                    logWarning(file, `${pair.target} (${targetVal}) fora de [${minVal}, ${maxVal}]`);
                }
            }
        }
    });
    
    return valid;
}

/**
 * Valida campos obrigatórios
 */
function validateRequiredFields(data, file) {
    let valid = true;
    
    REQUIRED_ROOT_FIELDS.forEach(field => {
        if (!(field in data) || !Number.isFinite(data[field])) {
            logError(file, `Campo obrigatório ausente ou inválido: ${field}`);
            valid = false;
        }
    });
    
    return valid;
}

/**
 * Valida valores dentro de ranges plausíveis
 */
function validatePlausibleRanges(data, file) {
    let valid = true;
    
    Object.entries(PLAUSIBLE_RANGES).forEach(([field, range]) => {
        if (field in data && Number.isFinite(data[field])) {
            const value = data[field];
            if (value < range.min || value > range.max) {
                const severity = field === 'true_peak_max' && value > 0 ? 'CRÍTICO' : 'implausível';
                logWarning(file, `${field} = ${value} ${severity} (esperado: ${range.min} a ${range.max})`);
                if (field === 'true_peak_max' && value > 0) {
                    valid = false; // true_peak_max > 0 é erro
                }
            }
        }
    });
    
    return valid;
}

/**
 * Valida estrutura de bandas
 */
function validateBands(data, file) {
    if (!data.bands) {
        logWarning(file, 'Campo bands ausente');
        return true;
    }
    
    let valid = true;
    const bands = data.bands;
    
    Object.entries(bands).forEach(([bandName, bandData]) => {
        if (!bandData || typeof bandData !== 'object') {
            logWarning(file, `Banda ${bandName} tem dados inválidos`);
            return;
        }
        
        // Verificar target_range
        if (bandData.target_range) {
            const tr = bandData.target_range;
            if (Number.isFinite(tr.min) && Number.isFinite(tr.max)) {
                if (tr.min >= tr.max) {
                    logError(file, `bands.${bandName}.target_range: min (${tr.min}) >= max (${tr.max})`);
                    valid = false;
                }
            }
        } else if (!Number.isFinite(bandData.target_db)) {
            logWarning(file, `bands.${bandName}: sem target_range nem target_db`);
        }
    });
    
    return valid;
}

/**
 * Valida sincronização entre work/ e public/
 */
function validateSyncBetweenDirs(workData, publicData, filename) {
    // Comparar campos principais
    const fieldsToCompare = [
        'lufs_target', 'lufs_min', 'lufs_max',
        'true_peak_target', 'true_peak_min', 'true_peak_max',
        'dr_target', 'dr_min', 'dr_max'
    ];
    
    let synced = true;
    
    fieldsToCompare.forEach(field => {
        const workVal = workData[field];
        const publicVal = publicData[field];
        
        if (workVal !== publicVal) {
            logWarning(filename, `DESSINCRONIZADO: ${field} work=${workVal} vs public=${publicVal}`);
            synced = false;
        }
    });
    
    return synced;
}

/**
 * Valida um arquivo JSON completo
 */
function validateJsonFile(filePath, isPublic = false) {
    const filename = path.basename(filePath);
    const prefix = isPublic ? '[PUBLIC] ' : '[WORK] ';
    
    console.log(`\n📄 ${prefix}${filename}`);
    filesChecked++;
    
    // Ignorar arquivos especiais
    const IGNORE_FILES = ['genres.json', 'restore-result.json', 'default.json'];
    if (IGNORE_FILES.includes(filename) || filename.includes('preview') || filename.includes('backup') || filename.includes('legacy') || filename.includes('ROLLBACK')) {
        console.log(`  ⏭️  Ignorado (arquivo especial)`);
        return null;
    }
    
    // Ler arquivo
    let rawData;
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        rawData = JSON.parse(content);
    } catch (err) {
        logError(filename, `Erro ao ler/parsear: ${err.message}`);
        return null;
    }
    
    // 🔍 DETECTAR ESTRUTURA: Os JSONs têm dados aninhados em obj[genreName]
    // Ex: funk_mandela.json → rawData.funk_mandela.lufs_target
    const genreKey = filename.replace('.json', '');
    let data = rawData;
    
    // Se existe uma chave com o nome do gênero, usar ela
    if (rawData[genreKey] && typeof rawData[genreKey] === 'object') {
        data = rawData[genreKey];
        console.log(`  📂 Estrutura aninhada detectada: ${genreKey}`);
    } else {
        // Tentar encontrar a primeira chave que parece ser dados de gênero
        const keys = Object.keys(rawData);
        for (const key of keys) {
            if (rawData[key] && typeof rawData[key] === 'object' && rawData[key].lufs_target !== undefined) {
                data = rawData[key];
                console.log(`  📂 Usando chave alternativa: ${key}`);
                break;
            }
        }
    }
    
    let isValid = true;
    
    // 1. TRUE PEAK MAX NUNCA > 0 (CRÍTICO)
    if (!validateTruePeakMax(data, filename)) {
        isValid = false;
    }
    
    // 2. Campos obrigatórios
    if (!validateRequiredFields(data, filename)) {
        isValid = false;
    }
    
    // 3. Consistência min/max
    if (!validateMinMaxConsistency(data, filename)) {
        isValid = false;
    }
    
    // 4. Ranges plausíveis
    if (!validatePlausibleRanges(data, filename)) {
        isValid = false;
    }
    
    // 5. Bandas
    if (!validateBands(data, filename)) {
        isValid = false;
    }
    
    if (isValid) {
        logOk('Todas as validações passaram');
        filesValid++;
    }
    
    return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 EXECUÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════════════');
console.log('🎯 VALIDATE-GENRE-TARGETS - Validação Completa');
console.log('═══════════════════════════════════════════════════════════════════');

// Listar JSONs
const workFiles = fs.existsSync(WORK_DIR) 
    ? fs.readdirSync(WORK_DIR).filter(f => f.endsWith('.json'))
    : [];
const publicFiles = fs.existsSync(PUBLIC_DIR)
    ? fs.readdirSync(PUBLIC_DIR).filter(f => f.endsWith('.json'))
    : [];

console.log(`\n📁 work/refs/out: ${workFiles.length} arquivos`);
console.log(`📁 public/refs/out: ${publicFiles.length} arquivos`);

// Validar work/
console.log('\n' + '─'.repeat(60));
console.log('🔍 VALIDANDO work/refs/out/');
console.log('─'.repeat(60));

const workDataMap = {};
workFiles.forEach(file => {
    const data = validateJsonFile(path.join(WORK_DIR, file), false);
    if (data) workDataMap[file] = data;
});

// Validar public/
console.log('\n' + '─'.repeat(60));
console.log('🔍 VALIDANDO public/refs/out/');
console.log('─'.repeat(60));

const publicDataMap = {};
publicFiles.forEach(file => {
    const data = validateJsonFile(path.join(PUBLIC_DIR, file), true);
    if (data) publicDataMap[file] = data;
});

// Verificar sincronização
console.log('\n' + '─'.repeat(60));
console.log('🔄 VERIFICANDO SINCRONIZAÇÃO work/ ↔ public/');
console.log('─'.repeat(60));

const allFiles = [...new Set([...workFiles, ...publicFiles])];
let syncCount = 0;

allFiles.forEach(file => {
    const workData = workDataMap[file];
    const publicData = publicDataMap[file];
    
    if (!workData && publicData) {
        logWarning(file, 'Existe apenas em public/, não em work/');
    } else if (workData && !publicData) {
        logWarning(file, 'Existe apenas em work/, não em public/');
    } else if (workData && publicData) {
        if (validateSyncBetweenDirs(workData, publicData, file)) {
            syncCount++;
        }
    }
});

console.log(`\n✅ ${syncCount}/${allFiles.length} arquivos sincronizados`);

// ═══════════════════════════════════════════════════════════════════════════
// 📊 RELATÓRIO FINAL
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log('📊 RELATÓRIO FINAL');
console.log('═'.repeat(60));

console.log(`\n📁 Arquivos verificados: ${filesChecked}`);
console.log(`✅ Arquivos válidos: ${filesValid}`);
console.log(`❌ Erros encontrados: ${errors.length}`);
console.log(`⚠️  Avisos: ${warnings.length}`);

if (errors.length > 0) {
    console.log('\n🚨 ERROS CRÍTICOS:');
    errors.forEach(e => {
        console.log(`   ${e.file}: ${e.message}`);
    });
}

if (warnings.length > 0) {
    console.log('\n⚠️  AVISOS:');
    warnings.forEach(w => {
        console.log(`   ${w.file}: ${w.message}`);
    });
}

// Exit code
const exitCode = errors.length > 0 ? 1 : 0;
console.log(`\n${'─'.repeat(60)}`);
console.log(exitCode === 0 
    ? '🎉 VALIDAÇÃO CONCLUÍDA COM SUCESSO!' 
    : '❌ VALIDAÇÃO FALHOU - CORRIGIR ERROS ACIMA');
console.log('─'.repeat(60));

process.exit(exitCode);
