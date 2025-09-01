/**
 * Reference Validator - Valida JSONs de referências em refs/out/<genero>.json
 * Mostra mediana, MAD, possíveis outliers e verifica tolerâncias.
 */

import fs from 'node:fs';
import path from 'node:path';

function median(values) {
	const arr = values.slice().sort((a, b) => a - b);
	const mid = Math.floor(arr.length / 2);
	return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
function mad(values, med) {
	const dev = values.map(v => Math.abs(v - med));
	return median(dev);
}
function zByMad(value, med, madVal) {
	if (madVal === 0) return 0;
	return Math.abs(value - med) / (1.4826 * madVal);
}

function validateTolerances(bandObj) {
	const tooSmall = bandObj.tol_db != null && bandObj.tol_db < 0.5;
	const tooBig = bandObj.tol_db != null && bandObj.tol_db > 3.0;
	return { tooSmall, tooBig };
}

function validateGenre(genreJson, genreName) {
	const g = genreJson[genreName];
	if (!g) throw new Error(`Gênero ${genreName} não encontrado no JSON`);
	if ((g.num_tracks || 0) < 8) throw new Error(`Gênero ${genreName} tem menos de 8 faixas válidas`);

	console.log(`\n📘 Validação: ${genreName}`);
	console.log(`Faixas usadas: ${g.num_tracks}`);

	// Parâmetros principais
	const params = [
		['lufs_target', 'tol_lufs'],
		['true_peak_target', 'tol_true_peak'],
		['dr_target', 'tol_dr'],
		['lra_target', 'tol_lra'],
		['stereo_target', 'tol_stereo'],
	];
	for (const [p, t] of params) {
		console.log(`${p}: ${g[p]} (tol=${g[t]})`);
	}

	// Bandas
	console.log('\n🎚️ Bandas:');
	for (const [band, obj] of Object.entries(g.bands || {})) {
		const { tooSmall, tooBig } = validateTolerances(obj);
		let flag = '';
		if (tooSmall) flag = '⚠️ tol muito pequena (<0.5dB)';
		if (tooBig) flag = '⚠️ tol muito grande (>3dB)';
		console.log(`- ${band}: target=${obj.target_db}dB tol=${obj.tol_db}dB ${flag}`);
	}

	// Heurística simples de outliers: targets muito fora do típico
	const bandTargets = Object.values(g.bands || {}).map(b => b.target_db).filter(Number.isFinite);
	if (bandTargets.length > 3) {
		const med = median(bandTargets);
		const m = mad(bandTargets, med);
		const outliers = bandTargets.filter(v => zByMad(v, med, m) > 3);
		if (outliers.length > 0) {
			console.log(`\n🚩 Possíveis outliers de banda (|z_MAD|>3): ${outliers.map(v => v.toFixed(1)).join(', ')}`);
		}
	}

	console.log('\n✅ Validação concluída');
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
	const genre = process.argv.slice(2).find(a => !a.startsWith('-'));
	if (!genre) {
		console.error('Uso: node tools/reference-validator.js <genero>');
		process.exit(1);
	}
	const fp = path.resolve(process.cwd(), 'refs', 'out', `${genre}.json`);
	if (!fs.existsSync(fp)) {
		console.error(`Arquivo não encontrado: ${fp}`);
		process.exit(1);
	}
	const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
	try {
		validateGenre(data, genre);
	} catch (e) {
		console.error('❌ Falha de validação:', e.message);
		process.exit(1);
	}
}
