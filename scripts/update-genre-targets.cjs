/**
 * 🎯 SCRIPT DE ATUALIZAÇÃO DE GENRE TARGETS
 * 
 * Este script atualiza TODOS os JSONs de targets em work/refs/out e public/refs/out
 * com os novos valores de pista, mantendo compatibilidade com o schema existente.
 * 
 * REGRAS:
 * - true_peak_max = 0.0 SEMPRE (TP nunca pode passar de 0 dBTP)
 * - Mantém todos os campos existentes
 * - Atualiza work/ e public/ em sincronia
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 NOVOS VALORES DE PISTA POR GÊNERO
// ═══════════════════════════════════════════════════════════════════════════

const GENRE_UPDATES = {
  funk_mandela: {
    lufs_target: -7.2,
    lufs_min: -9.5,
    lufs_max: -3.1,
    true_peak_target: -0.5,
    true_peak_min: -3.0,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.1,
    dr_target: 6.0,
    dr_min: 3.6,
    dr_max: 11.7,
    bands: {
      sub: { min: -28.3, max: -17.2 },
      low_bass: { min: -27.9, max: -19.1 },
      upper_bass: { min: -27.9, max: -19.1 },
      low_mid: { min: -29.7, max: -21.5 },
      mid: { min: -29.5, max: -24.1 },
      high_mid: { min: -34.6, max: -28.4 },
      brilho: { min: -44.3, max: -33.1 },
      presenca: { min: -42.8, max: -32.0 }
    }
  },
  
  edm: {
    lufs_target: -9.0,
    lufs_min: -12.2,
    lufs_max: -6.3,
    true_peak_target: -1.0,
    true_peak_min: -3.0,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.5,
    dr_target: 6.4,
    dr_min: 3.9,
    dr_max: 9.9,
    bands: {
      sub: { min: -27.0, max: -18.0 },
      low_bass: { min: -27.0, max: -19.0 },
      upper_bass: { min: -27.0, max: -19.0 },
      low_mid: { min: -31.5, max: -24.0 },
      mid: { min: -32.0, max: -26.5 },
      high_mid: { min: -38.0, max: -31.5 },
      brilho: { min: -44.0, max: -34.0 },
      presenca: { min: -46.0, max: -36.0 }
    }
  },
  
  funk_bruxaria: {
    lufs_target: -5.8,
    lufs_min: -7.0,
    lufs_max: -3.1,
    true_peak_target: -0.2,
    true_peak_min: -2.5,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.1,
    dr_target: 5.5,
    dr_min: 3.5,
    dr_max: 9.5,
    bands: {
      sub: { min: -27.5, max: -16.5 },
      low_bass: { min: -27.0, max: -18.5 },
      upper_bass: { min: -27.0, max: -18.5 },
      low_mid: { min: -31.0, max: -22.5 },
      mid: { min: -29.0, max: -24.0 },
      high_mid: { min: -36.0, max: -29.5 },
      brilho: { min: -48.0, max: -33.0 },
      presenca: { min: -44.5, max: -32.0 }
    }
  },
  
  funk_bh: {
    lufs_target: -8.5,
    lufs_min: -10.0,
    lufs_max: -5.5,
    true_peak_target: -0.8,
    true_peak_min: -2.5,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.3,
    dr_target: 7.5,
    dr_min: 5.0,
    dr_max: 11.0,
    bands: {
      sub: { min: -29.5, max: -18.0 },
      low_bass: { min: -28.5, max: -19.5 },
      upper_bass: { min: -28.5, max: -19.5 },
      low_mid: { min: -33.0, max: -24.0 },
      mid: { min: -30.0, max: -25.0 },
      high_mid: { min: -38.0, max: -31.0 },
      brilho: { min: -46.0, max: -36.0 },
      presenca: { min: -46.0, max: -36.0 }
    }
  },
  
  eletrofunk: {
    lufs_target: -8.5,
    lufs_min: -10.5,
    lufs_max: -6.5,
    true_peak_target: -0.5,
    true_peak_min: -2.0,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.15,
    dr_target: 6.5,
    dr_min: 4.5,
    dr_max: 9.5,
    bands: {
      sub: { min: -27.0, max: -18.0 },
      low_bass: { min: -26.5, max: -19.0 },
      upper_bass: { min: -26.5, max: -19.0 },
      low_mid: { min: -32.0, max: -24.5 },
      mid: { min: -32.5, max: -26.5 },
      high_mid: { min: -38.5, max: -32.0 },
      brilho: { min: -44.0, max: -34.0 },
      presenca: { min: -46.0, max: -36.5 }
    }
  },
  
  progressive_trance: {
    lufs_target: -8.5,
    lufs_min: -11.5,
    lufs_max: -6.5,
    true_peak_target: -1.0,
    true_peak_min: -3.0,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.5,
    dr_target: 8.0,
    dr_min: 6.5,
    dr_max: 11.0,
    bands: {
      sub: { min: -25.2, max: -17.5 },
      low_bass: { min: -26.0, max: -19.5 },
      upper_bass: { min: -26.0, max: -19.5 },
      low_mid: { min: -33.0, max: -25.0 },
      mid: { min: -33.0, max: -28.0 },
      high_mid: { min: -39.0, max: -33.0 },
      brilho: { min: -44.0, max: -33.0 },
      presenca: { min: -46.5, max: -37.5 }
    }
  },
  
  fullon: {
    lufs_target: -7.5,
    lufs_min: -9.0,
    lufs_max: -6.5,
    true_peak_target: -1.0,
    true_peak_min: -3.0,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.5,
    dr_target: 7.0,
    dr_min: 5.5,
    dr_max: 10.0,
    bands: {
      sub: { min: -24.5, max: -16.0 },
      low_bass: { min: -24.5, max: -18.0 },
      upper_bass: { min: -24.5, max: -18.0 },
      low_mid: { min: -32.5, max: -24.5 },
      mid: { min: -33.5, max: -28.5 },
      high_mid: { min: -38.0, max: -32.0 },
      brilho: { min: -41.5, max: -32.5 },
      presenca: { min: -44.5, max: -36.0 }
    }
  },
  
  house: {
    lufs_target: -9.5,
    lufs_min: -12.5,
    lufs_max: -6.5,
    true_peak_target: -1.0,
    true_peak_min: -3.0,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.5,
    dr_target: 8.0,
    dr_min: 6.0,
    dr_max: 11.0,
    bands: {
      sub: { min: -25.5, max: -18.0 },
      low_bass: { min: -25.5, max: -19.0 },
      upper_bass: { min: -25.5, max: -19.0 },
      low_mid: { min: -32.0, max: -25.0 },
      mid: { min: -32.5, max: -27.5 },
      high_mid: { min: -39.0, max: -33.5 },
      brilho: { min: -44.0, max: -35.0 },
      presenca: { min: -47.0, max: -39.0 }
    }
  },
  
  tech_house: {
    lufs_target: -9.5,
    lufs_min: -11.5,
    lufs_max: -7.5,
    true_peak_target: -1.0,
    true_peak_min: -3.0,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.5,
    dr_target: 7.0,
    dr_min: 5.5,
    dr_max: 10.0,
    bands: {
      sub: { min: -25.0, max: -17.5 },
      low_bass: { min: -24.0, max: -17.5 },
      upper_bass: { min: -24.0, max: -17.5 },
      low_mid: { min: -32.5, max: -25.5 },
      mid: { min: -32.5, max: -27.5 },
      high_mid: { min: -39.0, max: -33.0 },
      brilho: { min: -43.0, max: -34.0 },
      presenca: { min: -46.5, max: -38.0 }
    }
  },
  
  trap: {
    lufs_target: -10.5,
    lufs_min: -12.5,
    lufs_max: -8.5,
    true_peak_target: -1.0,
    true_peak_min: -2.5,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.5,
    dr_target: 7.0,
    dr_min: 5.0,
    dr_max: 10.5,
    bands: {
      sub: { min: -23.5, max: -16.0 },
      low_bass: { min: -24.5, max: -18.0 },
      upper_bass: { min: -24.5, max: -18.0 },
      low_mid: { min: -31.0, max: -24.0 },
      mid: { min: -31.5, max: -26.0 },
      high_mid: { min: -40.0, max: -34.0 },
      brilho: { min: -45.0, max: -36.0 },
      presenca: { min: -47.5, max: -39.0 }
    }
  },
  
  brazilian_phonk: {
    lufs_target: -6.5,
    lufs_min: -8.0,
    lufs_max: -4.5,
    true_peak_target: -0.2,
    true_peak_min: -2.0,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.05,
    dr_target: 4.5,
    dr_min: 3.0,
    dr_max: 7.0,
    bands: {
      sub: { min: -22.5, max: -14.5 },
      low_bass: { min: -23.5, max: -16.5 },
      upper_bass: { min: -23.5, max: -16.5 },
      low_mid: { min: -29.5, max: -21.5 },
      mid: { min: -30.0, max: -24.0 },
      high_mid: { min: -37.0, max: -30.0 },
      brilho: { min: -46.0, max: -34.5 },
      presenca: { min: -46.0, max: -35.0 }
    }
  },
  
  rap_drill: {
    lufs_target: -11.5,
    lufs_min: -14.0,
    lufs_max: -9.0,
    true_peak_target: -1.0,
    true_peak_min: -2.0,
    true_peak_max: 0.0,
    true_peak_warn_from: -0.5,
    dr_target: 8.0,
    dr_min: 5.5,
    dr_max: 12.0,
    bands: {
      sub: { min: -24.0, max: -16.5 },
      low_bass: { min: -24.5, max: -18.5 },
      upper_bass: { min: -24.5, max: -18.5 },
      low_mid: { min: -30.0, max: -23.5 },
      mid: { min: -32.0, max: -26.0 },
      high_mid: { min: -39.5, max: -33.0 },
      brilho: { min: -44.5, max: -34.5 },
      presenca: { min: -45.5, max: -36.5 }
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 FUNÇÕES DE ATUALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Atualiza um objeto de bandas com os novos valores de target_range
 */
function updateBands(existingBands, newBands) {
  if (!existingBands || !newBands) return existingBands;
  
  const updated = { ...existingBands };
  
  for (const [bandKey, newRange] of Object.entries(newBands)) {
    if (updated[bandKey]) {
      updated[bandKey] = {
        ...updated[bandKey],
        target_range: {
          min: newRange.min,
          max: newRange.max
        },
        // Calcular target_db como centro do range
        target_db: Number(((newRange.min + newRange.max) / 2).toFixed(2))
      };
    }
  }
  
  return updated;
}

/**
 * Atualiza um bloco de métricas (top-level ou legacy_compatibility)
 */
function updateMetricsBlock(block, updates, includeBands = false) {
  if (!block) return block;
  
  const updated = { ...block };
  
  // Atualizar métricas principais
  if (updates.lufs_target !== undefined) updated.lufs_target = updates.lufs_target;
  if (updates.true_peak_target !== undefined) updated.true_peak_target = updates.true_peak_target;
  if (updates.dr_target !== undefined) updated.dr_target = updates.dr_target;
  
  // Atualizar ranges min/max
  if (updates.lufs_min !== undefined) updated.lufs_min = updates.lufs_min;
  if (updates.lufs_max !== undefined) updated.lufs_max = updates.lufs_max;
  if (updates.true_peak_min !== undefined) updated.true_peak_min = updates.true_peak_min;
  if (updates.true_peak_max !== undefined) updated.true_peak_max = updates.true_peak_max;
  if (updates.true_peak_warn_from !== undefined) updated.true_peak_warn_from = updates.true_peak_warn_from;
  if (updates.dr_min !== undefined) updated.dr_min = updates.dr_min;
  if (updates.dr_max !== undefined) updated.dr_max = updates.dr_max;
  
  // Atualizar tolerâncias para serem metade do range (aproximado)
  if (updates.lufs_min !== undefined && updates.lufs_max !== undefined) {
    const range = updates.lufs_max - updates.lufs_min;
    updated.tol_lufs = Number((range / 2).toFixed(1));
  }
  if (updates.dr_min !== undefined && updates.dr_max !== undefined) {
    const range = updates.dr_max - updates.dr_min;
    updated.tol_dr = Number((range / 2).toFixed(1));
  }
  if (updates.true_peak_min !== undefined && updates.true_peak_max !== undefined) {
    const range = updates.true_peak_max - updates.true_peak_min;
    updated.tol_true_peak = Number((range / 2).toFixed(1));
  }
  
  // Atualizar bandas se solicitado
  if (includeBands && updates.bands && updated.bands) {
    updated.bands = updateBands(updated.bands, updates.bands);
  }
  
  return updated;
}

/**
 * Atualiza um JSON de gênero completo
 */
function updateGenreJson(jsonData, genreKey, updates) {
  if (!jsonData[genreKey]) {
    console.warn(`⚠️ Gênero ${genreKey} não encontrado no JSON`);
    return jsonData;
  }
  
  const genre = { ...jsonData[genreKey] };
  
  // Atualizar nível raiz
  if (updates.lufs_target !== undefined) genre.lufs_target = updates.lufs_target;
  if (updates.true_peak_target !== undefined) genre.true_peak_target = updates.true_peak_target;
  if (updates.dr_target !== undefined) genre.dr_target = updates.dr_target;
  if (updates.lufs_min !== undefined) genre.lufs_min = updates.lufs_min;
  if (updates.lufs_max !== undefined) genre.lufs_max = updates.lufs_max;
  if (updates.true_peak_min !== undefined) genre.true_peak_min = updates.true_peak_min;
  if (updates.true_peak_max !== undefined) genre.true_peak_max = updates.true_peak_max;
  if (updates.true_peak_warn_from !== undefined) genre.true_peak_warn_from = updates.true_peak_warn_from;
  if (updates.dr_min !== undefined) genre.dr_min = updates.dr_min;
  if (updates.dr_max !== undefined) genre.dr_max = updates.dr_max;
  
  // Atualizar tolerâncias
  if (updates.lufs_min !== undefined && updates.lufs_max !== undefined) {
    const range = updates.lufs_max - updates.lufs_min;
    genre.tol_lufs = Number((range / 2).toFixed(1));
  }
  if (updates.dr_min !== undefined && updates.dr_max !== undefined) {
    const range = updates.dr_max - updates.dr_min;
    genre.tol_dr = Number((range / 2).toFixed(1));
  }
  if (updates.true_peak_min !== undefined && updates.true_peak_max !== undefined) {
    const range = updates.true_peak_max - updates.true_peak_min;
    genre.tol_true_peak = Number((range / 2).toFixed(1));
  }
  
  // Atualizar bandas no nível raiz
  if (updates.bands && genre.bands) {
    genre.bands = updateBands(genre.bands, updates.bands);
  }
  
  // Atualizar hybrid_processing
  if (genre.hybrid_processing) {
    if (genre.hybrid_processing.original_metrics) {
      genre.hybrid_processing.original_metrics = {
        ...genre.hybrid_processing.original_metrics,
        lufs_integrated: updates.lufs_target,
        true_peak_dbtp: updates.true_peak_target,
        dynamic_range: updates.dr_target
      };
    }
    if (genre.hybrid_processing.spectral_bands && updates.bands) {
      genre.hybrid_processing.spectral_bands = updateBands(
        genre.hybrid_processing.spectral_bands,
        updates.bands
      );
    }
  }
  
  // Atualizar legacy_compatibility
  if (genre.legacy_compatibility) {
    genre.legacy_compatibility = updateMetricsBlock(
      genre.legacy_compatibility,
      updates,
      true
    );
  }
  
  // Atualizar timestamps
  genre.last_updated = new Date().toISOString();
  genre.cache_bust = Date.now();
  genre.generated_at = new Date().toISOString();
  
  return { [genreKey]: genre };
}

/**
 * Processa um arquivo JSON
 */
function processJsonFile(filePath, genreKey, updates) {
  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(rawContent);
    
    const updatedJson = updateGenreJson(jsonData, genreKey, updates);
    
    fs.writeFileSync(filePath, JSON.stringify(updatedJson, null, 2) + '\n', 'utf-8');
    console.log(`✅ Atualizado: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 EXECUÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎯 ATUALIZADOR DE GENRE TARGETS - SoundyAI');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  const workDir = path.join(__dirname, '..', 'work', 'refs', 'out');
  const publicDir = path.join(__dirname, '..', 'public', 'refs', 'out');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const [genreKey, updates] of Object.entries(GENRE_UPDATES)) {
    console.log(`\n📦 Processando: ${genreKey}`);
    
    // Atualizar work/refs/out
    const workPath = path.join(workDir, `${genreKey}.json`);
    if (fs.existsSync(workPath)) {
      if (processJsonFile(workPath, genreKey, updates)) {
        successCount++;
      } else {
        failCount++;
      }
    } else {
      console.warn(`⚠️ Arquivo não encontrado: ${workPath}`);
    }
    
    // Atualizar public/refs/out
    const publicPath = path.join(publicDir, `${genreKey}.json`);
    if (fs.existsSync(publicPath)) {
      if (processJsonFile(publicPath, genreKey, updates)) {
        successCount++;
      } else {
        failCount++;
      }
    } else {
      console.warn(`⚠️ Arquivo não encontrado: ${publicPath}`);
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📊 RESULTADO: ${successCount} arquivos atualizados, ${failCount} falhas`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  process.exit(failCount > 0 ? 1 : 0);
}

main();
