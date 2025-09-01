#!/usr/bin/env node
/**
 * CORREÇÃO FOCAL - FUNK MANDELA METRICS
 * 
 * Escopo restrito: corrigir apenas TP, LRA e correlação estéreo do funk_mandela.
 * Mantém intacto: LUFS, DR, bandas espectrais, tolerâncias, UI, presets.
 * 
 * Problema identificado:
 * - TP: ~-0.3 dBTP (pós-norm) vs. -8 a -12 dBTP (pré-norm per-track)
 * - LRA: ~2.5 LU vs. 3-14 LU (per-track)
 * - Estéreo: correlação 0.22±0.2 (interpretação/escala)
 */

import fs from 'fs';
import path from 'path';

const FUNK_MANDELA_JSON = 'c:/Users/DJ Correa/Desktop/Programação/ai-synth/refs/out/funk_mandela.json';
const CALIB_LOG = 'c:/Users/DJ Correa/Desktop/Programação/ai-synth/refs/out/calib-funk_mandela.txt';

async function extractPerTrackMetrics() {
    console.log('📊 Extraindo métricas per-track do log de calibração...');
    
    const logContent = fs.readFileSync(CALIB_LOG, 'utf8');
    
    // Extrair True Peak pré-normalização dos logs de processamento
    const tpMatches = logContent.match(/peak: '(-?\d+\.?\d*) dBTP'/g) || [];
    const truePeaks = tpMatches.map(match => {
        const value = parseFloat(match.match(/-?\d+\.?\d*/)[0]);
        return value;
    }).filter(val => !isNaN(val));
    
    // Extrair LRA dos logs LUFS
    const lraMatches = logContent.match(/lra: '(\d+\.?\d*) LU'/g) || [];
    const lraValues = lraMatches.map(match => {
        const value = parseFloat(match.match(/\d+\.?\d*/)[0]);
        return value;
    }).filter(val => !isNaN(val));
    
    // Extrair correlação estéreo dos resultados finais
    const stereoMatches = logContent.match(/stereo_width: val=(\d+\.?\d*)/g) || [];
    const stereoWidths = stereoMatches.map(match => {
        const value = parseFloat(match.match(/\d+\.?\d*/)[0]);
        return value;
    }).filter(val => !isNaN(val));
    
    console.log(`✅ Extraído: ${truePeaks.length} True Peaks, ${lraValues.length} LRAs, ${stereoWidths.length} Stereo`);
    
    return {
        truePeaks,
        lraValues,
        stereoWidths
    };
}

function calculateRobustStats(values) {
    if (!values || values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const median = n % 2 === 0 
        ? (sorted[n/2 - 1] + sorted[n/2]) / 2 
        : sorted[Math.floor(n/2)];
    
    const p10 = sorted[Math.floor(n * 0.1)];
    const p90 = sorted[Math.floor(n * 0.9)];
    
    return { mean, median, p10, p90, n };
}

function stereoCorrelationFromWidth(width) {
    // Se width = (1 - correlation) / 2, então correlation = 1 - 2*width
    return 1 - (2 * width);
}

async function main() {
    console.log('🔧 CORREÇÃO FOCAL - FUNK MANDELA METRICS');
    console.log('Escopo: TP pré-norm, LRA pré-norm, correlação estéreo\n');
    
    // 1. Extrair métricas per-track dos logs
    const metrics = await extractPerTrackMetrics();
    
    // 2. Calcular agregados robustos
    const tpStats = calculateRobustStats(metrics.truePeaks);
    const lraStats = calculateRobustStats(metrics.lraValues);
    const stereoStats = calculateRobustStats(metrics.stereoWidths);
    
    if (!tpStats || !lraStats || !stereoStats) {
        console.error('❌ Erro: não foi possível extrair métricas suficientes');
        process.exit(1);
    }
    
    // 3. Converter largura estéreo para correlação
    const stereoCorrelations = metrics.stereoWidths.map(stereoCorrelationFromWidth);
    const corrStats = calculateRobustStats(stereoCorrelations);
    
    // 4. Carregar JSON atual
    const currentData = JSON.parse(fs.readFileSync(FUNK_MANDELA_JSON, 'utf8'));
    const funk = currentData.funk_mandela;
    
    // 5. Salvar valores ANTES (para log)
    const beforeTP = funk.legacy_compatibility.true_peak_target;
    const beforeLRA = funk.legacy_compatibility.lra_target;
    const beforeStereo = funk.legacy_compatibility.stereo_target;
    
    // 6. Atualizar apenas os campos necessários
    funk.legacy_compatibility.true_peak_target = Math.round(tpStats.median * 10) / 10;
    funk.legacy_compatibility.tol_true_peak = Math.max(1.5, Math.round((tpStats.p90 - tpStats.p10) / 2 * 10) / 10);
    
    funk.legacy_compatibility.lra_target = Math.round(lraStats.median * 10) / 10;
    funk.legacy_compatibility.tol_lra = Math.max(1.5, Math.round((lraStats.p90 - lraStats.p10) / 2 * 10) / 10);
    
    funk.legacy_compatibility.stereo_target = Math.round(corrStats.median * 100) / 100;
    funk.legacy_compatibility.tol_stereo = Math.max(0.15, Math.round((corrStats.p90 - corrStats.p10) / 2 * 100) / 100);
    
    // 7. Atualizar fixed/flex para consistência
    funk.fixed.truePeak.streamingMax = funk.legacy_compatibility.true_peak_target;
    funk.flex.lra.min = Math.max(1, funk.legacy_compatibility.lra_target - funk.legacy_compatibility.tol_lra);
    funk.flex.lra.max = funk.legacy_compatibility.lra_target + funk.legacy_compatibility.tol_lra;
    
    // 8. Versionar
    const oldVersion = funk.version;
    funk.version = oldVersion.includes('flex.') 
        ? oldVersion.replace(/flex\.\d+$/, `flex.${parseInt(oldVersion.split('.').pop()) + 1}`)
        : `${oldVersion}.2`;
    
    funk.generated_at = new Date().toISOString();
    
    // 9. Adicionar nota sobre interpretação estéreo
    funk.notes += ` Estéreo: correlação (-1..+1) calculada como 1-2*largura; largura exibível = (1-correlação)/2.`;
    
    // 10. Salvar
    fs.writeFileSync(FUNK_MANDELA_JSON, JSON.stringify(currentData, null, 2));
    
    // 11. Log final
    console.log('\n=== AJUSTES FOCAIS — FUNK MANDELA (pré-normalização) ===');
    console.log(`TP   : mean ${tpStats.mean.toFixed(1)} dBTP | median ${tpStats.median.toFixed(1)} | p10/p90 ${tpStats.p10.toFixed(1)}/${tpStats.p90.toFixed(1)} | n ${tpStats.n}   (ANTES: ${beforeTP} pós-normalização)`);
    console.log(`LRA  : mean ${lraStats.mean.toFixed(1)} LU   | median ${lraStats.median.toFixed(1)} | p10/p90 ${lraStats.p10.toFixed(1)}/${lraStats.p90.toFixed(1)} | n ${lraStats.n}   (método EBU R128, mesma janela do per-track)`);
    console.log(`Stereo (corr): mean ${corrStats.mean.toFixed(2)} (-1..+1) | largura exibível ≈ (1-${corrStats.median.toFixed(2)})/2 = ${((1-corrStats.median)/2).toFixed(2)}`);
    console.log('Observação: LUFS/DR/Bandas mantidos SEM ALTERAÇÃO.');
    console.log(`\n✅ Atualizado: ${oldVersion} → ${funk.version}`);
    console.log(`📁 Arquivo: ${FUNK_MANDELA_JSON}`);
}

main().catch(console.error);
