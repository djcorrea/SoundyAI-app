/**
 * Reference Builder - Gera JSONs de referência por gênero em refs/out/<genero>.json
 * Regras: sem dependências externas; usar módulos existentes em lib/audio/*; Node ESM.
 * Janela ~1s, hop ~0.5s; normalização para o mesmo alvo LUFS do sistema (default -14 LUFS).
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Reuso de funções internas do projeto
import { STFTEngine, nextPowerOfTwo } from '../lib/audio/fft.js';
import { calculateLoudnessMetrics } from '../lib/audio/features/loudness.js';
import { analyzeTruePeaks } from '../lib/audio/features/truepeak.js';

// Configuração compartilhada
const CONFIG = {
	sampleRate: 48000,
	lufsTarget: -14, // Se o sistema definir outro, ajuste aqui e no online
	windowSeconds: 1.0,
	hopSeconds: 0.5,
	useLinearAggregation: true, // Flag v2: usar agregação linear correta (default: true)
	bands: [
		{ key: 'sub', range: [20, 60] },
		{ key: 'low_bass', range: [60, 120] },
		{ key: 'upper_bass', range: [120, 200] },
		{ key: 'low_mid', range: [200, 500] },
		{ key: 'mid', range: [500, 2000] },
		{ key: 'high_mid', range: [2000, 4000] },
		{ key: 'brilho', range: [4000, 8000] },
		{ key: 'presenca', range: [8000, 12000] },
		{ key: 'air', range: [12000, 16000] }, // usado se aplicável
	]
};

// Util: leitura de WAV (PCM 16/24/32, float32)
async function readWavFile(filePath) {
	const buf = await fsp.readFile(filePath);
	// Checar RIFF/WAVE
	if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
		throw new Error('Formato não suportado (apenas WAV)');
	}
	// Encontrar chunks fmt/data
	let offset = 12;
	let format, numChannels, sampleRate, bitsPerSample, dataOffset = -1, dataSize = 0;
	while (offset + 8 <= buf.length) {
		const chunkId = buf.toString('ascii', offset, offset + 4);
		const chunkSize = buf.readUInt32LE(offset + 4);
		const chunkStart = offset + 8;
		if (chunkId === 'fmt ') {
			format = buf.readUInt16LE(chunkStart);
			numChannels = buf.readUInt16LE(chunkStart + 2);
			sampleRate = buf.readUInt32LE(chunkStart + 4);
			bitsPerSample = buf.readUInt16LE(chunkStart + 14);
		} else if (chunkId === 'data') {
			dataOffset = chunkStart;
			dataSize = chunkSize;
			break;
		}
		offset = chunkStart + chunkSize + (chunkSize % 2); // alinhamento
	}
	if (dataOffset < 0) throw new Error('Chunk data não encontrado');
	// Extrair PCM
	const bytesPerSample = bitsPerSample / 8;
	const frameCount = Math.floor(dataSize / (bytesPerSample * numChannels));
	const left = new Float32Array(frameCount);
	const right = new Float32Array(frameCount);
	let pos = dataOffset;
	for (let i = 0; i < frameCount; i++) {
		// Canal L
		let sL;
		if (format === 3 && bitsPerSample === 32) {
			sL = buf.readFloatLE(pos);
		} else if (bitsPerSample === 16) {
			sL = buf.readInt16LE(pos) / 32768;
		} else if (bitsPerSample === 24) {
			const b0 = buf[pos];
			const b1 = buf[pos + 1];
			const b2 = buf[pos + 2];
			let val = b0 | (b1 << 8) | (b2 << 16);
			if (val & 0x800000) val |= 0xFF000000;
			sL = val / 8388608;
		} else if (bitsPerSample === 32) {
			sL = buf.readInt32LE(pos) / 2147483648;
		} else {
			throw new Error(`PCM não suportado: ${bitsPerSample} bits`);
		}
		pos += bytesPerSample;
		// Canal R (ou duplicar L se mono)
		let sR;
		if (numChannels > 1) {
			if (format === 3 && bitsPerSample === 32) {
				sR = buf.readFloatLE(pos);
			} else if (bitsPerSample === 16) {
				sR = buf.readInt16LE(pos) / 32768;
			} else if (bitsPerSample === 24) {
				const c0 = buf[pos];
				const c1 = buf[pos + 1];
				const c2 = buf[pos + 2];
				let v = c0 | (c1 << 8) | (c2 << 16);
				if (v & 0x800000) v |= 0xFF000000;
				sR = v / 8388608;
			} else if (bitsPerSample === 32) {
				sR = buf.readInt32LE(pos) / 2147483648;
			} else {
				throw new Error(`PCM não suportado: ${bitsPerSample} bits`);
			}
			pos += bytesPerSample;
		} else {
			sR = sL;
		}
		left[i] = sL;
		right[i] = sR;
	}
	return { left, right, sampleRate, channels: numChannels };
}

// Util: resample linear para 48k
function resampleLinear(channel, fromRate, toRate) {
	if (fromRate === toRate) return channel;
	const ratio = toRate / fromRate;
	const outLen = Math.floor(channel.length * ratio);
	const out = new Float32Array(outLen);
	for (let i = 0; i < outLen; i++) {
		const srcPos = i / ratio;
		const i0 = Math.floor(srcPos);
		const i1 = Math.min(i0 + 1, channel.length - 1);
		const t = srcPos - i0;
		out[i] = channel[i0] * (1 - t) + channel[i1] * t;
	}
	return out;
}

// Util: aplicar ganho linear (dB)
function applyGainDb(data, gainDb) {
	const g = Math.pow(10, gainDb / 20);
	for (let i = 0; i < data.length; i++) data[i] *= g;
}

// Stereo width simples 0..1
function stereoWidth01(left, right) {
	const n = left.length;
	let sumMid = 0, sumSide = 0;
	for (let i = 0; i < n; i++) {
		const mid = (left[i] + right[i]) * 0.5;
		const side = (left[i] - right[i]) * 0.5;
		sumMid += mid * mid;
		sumSide += side * side;
	}
	const rmsMid = Math.sqrt(sumMid / n);
	const rmsSide = Math.sqrt(sumSide / n);
	const width = rmsMid > 0 ? Math.min(1, Math.max(0, rmsSide / rmsMid)) : 0;
	return width;
}

// RMS dBFS util
function rmsDb(left, right) {
	const n = Math.min(left.length, right.length);
	let sum = 0;
	for (let i = 0; i < n; i++) {
		const m = (left[i] + right[i]) * 0.5;
		sum += m * m;
	}
	const rms = Math.sqrt(sum / n);
	return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

// Band indices util
function bandToBins(range, freqBins) {
	const [f0, f1] = range;
	let i0 = 1, i1 = freqBins.length - 1;
	for (let i = 1; i < freqBins.length; i++) { if (freqBins[i] >= f0) { i0 = i; break; } }
	for (let i = i0; i < freqBins.length; i++) { if (freqBins[i] >= f1) { i1 = i; break; } }
	return [i0, Math.max(i1, i0 + 1)];
}

// Energia relativa por banda (dB rel. global 20-16k)
// CORRIGIDO: agregação no domínio linear para evitar valores positivos incorretos
function computeBandProfile(left, right, sampleRate) {
	// Janela/hop conforme CONFIG
	const win = Math.round(CONFIG.windowSeconds * sampleRate);
	const hop = Math.round(CONFIG.hopSeconds * sampleRate);
	const fftSize = nextPowerOfTwo(win);
	const stft = new STFTEngine(fftSize, hop, 'hann');
	// Usar canal mono (mid) para perfil tonal
	const mono = new Float32Array(Math.min(left.length, right.length));
	for (let i = 0; i < mono.length; i++) mono[i] = 0.5 * (left[i] + right[i]);
	const { spectrogram, freqBins } = stft.analyze(mono, sampleRate);

	// Pré-calcular ranges de bins
	const binRanges = CONFIG.bands.map(b => ({ key: b.key, bins: bandToBins(b.range, freqBins) }));

	if (CONFIG.useLinearAggregation) {
		// VERSÃO v2: Agregação linear correta
		const bandLinearAccum = new Map(CONFIG.bands.map(b => [b.key, 0]));
		let totalFrames = 0;
		
		for (const frameMag of spectrogram) {
			// Converter para power
			const framePow = frameMag.map(v => v * v);
			// Energia global útil (20..16k)
			const [g0, g1] = bandToBins([20, 16000], freqBins);
			let global = 0;
			for (let i = g0; i < g1; i++) global += framePow[i];
			if (global <= 0) continue;
			
			// Acumular energias lineares para cada banda
			for (const { key, bins } of binRanges) {
				let sum = 0;
				for (let i = bins[0]; i < bins[1]; i++) sum += framePow[i];
				// Armazenar razão linear (banda/global) em vez de dB
				const ratio = sum / global;
				bandLinearAccum.set(key, bandLinearAccum.get(key) + ratio);
			}
			totalFrames++;
		}

		// Calcular médias lineares e converter para dB
		const profile = {};
		for (const { key } of binRanges) {
			if (totalFrames > 0) {
				const avgLinearRatio = bandLinearAccum.get(key) / totalFrames;
				// Converter média linear para dB relativo
				profile[key] = avgLinearRatio > 0 ? 10 * Math.log10(avgLinearRatio) : -80;
			} else {
				profile[key] = -80;
			}
		}
		return profile;
	} else {
		// VERSÃO v1: Agregação original (mantida para compatibilidade)
		const bandAccum = new Map(CONFIG.bands.map(b => [b.key, 0]));
		let totalFrames = 0;
		for (const frameMag of spectrogram) {
			// Converter para power
			const framePow = frameMag.map(v => v * v);
			// Energia global útil (20..16k)
			const [g0, g1] = bandToBins([20, 16000], freqBins);
			let global = 0;
			for (let i = g0; i < g1; i++) global += framePow[i];
			if (global <= 0) continue;
			// Cada banda em dB relativo
			for (const { key, bins } of binRanges) {
				let sum = 0;
				for (let i = bins[0]; i < bins[1]; i++) sum += framePow[i];
				const rel = sum > 0 ? 10 * Math.log10(sum / global) : -80;
				bandAccum.set(key, bandAccum.get(key) + rel);
			}
			totalFrames++;
		}

		// Média temporal
		const profile = {};
		for (const { key } of binRanges) {
			profile[key] = totalFrames > 0 ? bandAccum.get(key) / totalFrames : -80;
		}
		return profile;
	}
}

// Medidas técnicas universais por faixa (após normalização para LUFS alvo)
function measureTrack(left, right, sampleRate) {
	// LUFS / LRA
	const lufs = calculateLoudnessMetrics(left, right, sampleRate);
	const gainDb = CONFIG.lufsTarget - lufs.lufs_integrated;
	const leftN = new Float32Array(left);
	const rightN = new Float32Array(right);
	applyGainDb(leftN, gainDb);
	applyGainDb(rightN, gainDb);

	// True Peak
	const tp = analyzeTruePeaks(leftN, rightN, sampleRate);

	// Stereo width
	const stereo = stereoWidth01(leftN, rightN);

	// DR (crest factor aprox.)
	const rms = rmsDb(leftN, rightN);
	const peakDb = Math.max(tp.sample_peak_left_db || -Infinity, tp.sample_peak_right_db || -Infinity);
	const dr = (peakDb > -Infinity && rms > -Infinity) ? (peakDb - rms) : 0;

	// Band profile (dB relativos)
	const bandsDb = computeBandProfile(leftN, rightN, sampleRate);

	// Derivados
	const calor = bandsDb.low_mid ?? 0; // 200–500 Hz relativo
	const brilho = Math.max(bandsDb.brilho ?? -80, bandsDb.presenca ?? -80, bandsDb.air ?? -80);
	// Clareza: (2–4kHz) - (120–250Hz) aprox.
	const clareza = (bandsDb.high_mid ?? 0) - (0.7 * (bandsDb.upper_bass ?? 0) + 0.3 * (bandsDb.low_mid ?? 0));

	return {
		lufs_integrated: CONFIG.lufsTarget, // após normalização
		lra: lufs.lra,
		true_peak_dbtp: tp.true_peak_dbtp,
		stereo_width: stereo,
		dr: dr,
		bands_db: bandsDb,
		calor, brilho, clareza
	};
}

// Estatística robusta: mediana e MAD
function median(values) {
	const arr = values.slice().sort((a, b) => a - b);
	const mid = Math.floor(arr.length / 2);
	return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
function mad(values, med) {
	const dev = values.map(v => Math.abs(v - med));
	return median(dev);
}
function tols(valueMad, minTol) {
	return Math.max(minTol, 1.4826 * valueMad);
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// Pipeline principal
async function buildGenre(genre) {
	const inDir = path.resolve(process.cwd(), 'refs', genre);
	const samplesDir = path.join(inDir, 'samples');
	const outDir = path.resolve(process.cwd(), 'refs', 'out');
	await fsp.mkdir(outDir, { recursive: true });

	// Procurar WAVs primeiro na pasta samples/, depois na pasta principal
	let searchDir = samplesDir;
	let files = [];
	try {
		if (fs.existsSync(samplesDir)) {
			files = (await fsp.readdir(samplesDir)).filter(f => f.toLowerCase().endsWith('.wav'));
		}
	} catch (e) {
		// Se samples/ não existir ou der erro, usar pasta principal
	}
	
	if (files.length === 0) {
		searchDir = inDir;
		try {
			files = (await fsp.readdir(inDir)).filter(f => f.toLowerCase().endsWith('.wav'));
		} catch (e) {
			// Ignora erro de leitura
		}
	}

	if (files.length === 0) {
		console.error(`Nenhum WAV encontrado em ${samplesDir} ou ${inDir}. Adicione referências WAV.`);
		process.exit(1);
	}

	console.log(`Iniciando build para gênero '${genre}' em ${searchDir} | WAVs: ${files.length}`);

	const perTrack = [];
	for (const f of files) {
		const fp = path.join(searchDir, f);
		try {
			const wav = await readWavFile(fp);
			let L = wav.left, R = wav.right;
			if (wav.sampleRate !== CONFIG.sampleRate) {
				L = resampleLinear(L, wav.sampleRate, CONFIG.sampleRate);
				R = resampleLinear(R, wav.sampleRate, CONFIG.sampleRate);
			}
			perTrack.push(measureTrack(L, R, CONFIG.sampleRate));
			console.log(`✔️ Processado: ${f}`);
		} catch (e) {
			console.warn(`⚠️ Ignorado ${f}: ${e.message}`);
		}
	}

	if (perTrack.length === 0) {
		console.error('Nenhuma faixa válida processada. Abortando.');
		process.exit(1);
	}

	// Agregação: parâmetros universais
	const lraVals = perTrack.map(t => t.lra);
	const tpVals = perTrack.map(t => t.true_peak_dbtp);
	const drVals = perTrack.map(t => t.dr);
	const stereoVals = perTrack.map(t => t.stereo_width);
	const calorVals = perTrack.map(t => t.calor);
	const brilhoVals = perTrack.map(t => t.brilho);
	const clarezaVals = perTrack.map(t => t.clareza);

	const lraMed = median(lraVals);
	const tpMed = median(tpVals);
	const drMed = median(drVals);
	let stereoMed = median(stereoVals);
	// Sanidade estéreo 0..1
	if (!(stereoMed >= 0 && stereoMed <= 1)) {
		const old = stereoMed;
		stereoMed = clamp(stereoMed, 0, 1);
		console.warn(`⚠️ stereo_target fora de 0–1 (=${round2(old)}). Ajustado para ${round2(stereoMed)}.`);
	}
	const calorMed = median(calorVals);
	const brilhoMed = median(brilhoVals);
	const clarezaMed = median(clarezaVals);

	// Tolerâncias iniciais (MAD) com faixas/clamps exigidos
	let lraTol = tols(mad(lraVals, lraMed), 0.8);
	let tpTol = tols(mad(tpVals, tpMed), 0.1);
	let drTol = tols(mad(drVals, drMed), 0.8);
	let stereoTol = tols(mad(stereoVals, stereoMed), 0.02);
	// Clamps por regra: DR/LRA 0.8–4.0; stereo 0.02–0.15; bands 0.5–3.0; true peak até 2.0
	lraTol = clamp(lraTol, 0.8, 4.0);
	drTol = clamp(drTol, 0.8, 4.0);
	stereoTol = clamp(stereoTol, 0.02, 0.15);
	tpTol = clamp(tpTol, 0.1, 2.0);
	const calorTol = tols(mad(calorVals, calorMed), 0.5);
	const brilhoTol = tols(mad(brilhoVals, brilhoMed), 0.5);
	const clarezaTol = tols(mad(clarezaVals, clarezaMed), 0.5);

	// Band aggregation
	const bandKeys = CONFIG.bands.map(b => b.key).filter(k => k !== 'air');
	const bandsOut = {};
	for (const key of bandKeys) {
		const vals = perTrack.map(t => t.bands_db[key]).filter(v => Number.isFinite(v));
		const med = median(vals);
		let tol = tols(mad(vals, med), 1.0);
		// Clamp por regra: 0.5–3.0 dB
		tol = clamp(tol, 0.5, 3.0);
		bandsOut[key] = { target_db: round1(med), tol_db: round1(tol) };
	}

	const outJson = {
		[genre]: {
			version: CONFIG.useLinearAggregation ? 'v2.0' : 'v1.0',
			generated_at: new Date().toISOString(),
			num_tracks: perTrack.length,
			aggregation_method: CONFIG.useLinearAggregation ? 'linear_domain' : 'dB_domain_legacy',
			lufs_target: CONFIG.lufsTarget,
			// tol_lufs com clamp 0.3–1.5 (valor inicial padrão 0.5)
			tol_lufs: clamp(0.5, 0.3, 1.5),
			true_peak_target: round2(tpMed),
			tol_true_peak: round2(tpTol),
			dr_target: round1(drMed),
			tol_dr: round1(drTol),
			lra_target: round1(lraMed),
			tol_lra: round1(lraTol),
			stereo_target: round2(stereoMed),
			tol_stereo: round2(stereoTol),
			calor_target: round2(calorMed),
			brilho_target: round2(brilhoMed),
			clareza_target: round2(clarezaMed),
			bands: bandsOut
		}
	};

	const outPath = path.join(outDir, `${genre}.json`);
	await fsp.writeFile(outPath, JSON.stringify(outJson, null, 2), 'utf8');
	console.log(`\n✅ Referência gerada: ${outPath}`);
	console.log(`Faixas válidas: ${perTrack.length}`);
}

function round1(x) { return Number.isFinite(x) ? Math.round(x * 10) / 10 : x; }
function round2(x) { return Number.isFinite(x) ? Math.round(x * 100) / 100 : x; }

// CLI (compatível com Windows)
try {
	const thisFile = fileURLToPath(import.meta.url);
	if (thisFile === process.argv[1]) {
		const args = process.argv.slice(2);
		const genre = args.find(a => !a.startsWith('-'));
		
		// Processar flags
		if (args.includes('--v1') || args.includes('--legacy')) {
			CONFIG.useLinearAggregation = false;
			console.log('🔧 Usando agregação v1.0 (legacy dB domain)');
		} else if (args.includes('--v2') || args.includes('--linear')) {
			CONFIG.useLinearAggregation = true;
			console.log('🔧 Usando agregação v2.0 (linear domain corrigida)');
		} else {
			console.log('🔧 Usando agregação v2.0 (default - linear domain)');
		}
		
		if (!genre) {
			console.error('Uso: node tools/reference-builder.js <genero> [--v1|--v2] [--legacy|--linear]');
			console.error('  --v1/--legacy: usar método antigo (pode gerar valores positivos incorretos)');
			console.error('  --v2/--linear: usar método corrigido com agregação linear (default)');
			process.exit(1);
		}
		buildGenre(genre).catch(err => {
			console.error('Erro ao gerar referência:', err);
			process.exit(1);
		});
	}
} catch (e) {
	// Fallback: tenta sempre rodar se não conseguir resolver
	const args = process.argv.slice(2);
	const genre = args.find(a => !a.startsWith('-'));
	if (genre) {
		if (args.includes('--v1') || args.includes('--legacy')) CONFIG.useLinearAggregation = false;
		buildGenre(genre).catch(err => { console.error('Erro ao gerar referência:', err); process.exit(1); });
	}
}
