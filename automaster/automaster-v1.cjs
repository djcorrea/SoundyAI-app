#!/usr/bin/env node
/**
 * AutoMaster V1 - Núcleo Técnico (TWO-PASS PRECISION)
 * 
 * Script isolado para masterização de precisão usando FFmpeg loudnorm two-pass.
 * NÃO integrado com filas, banco, API ou frontend.
 * 
 * Implementação:
 *   - Loudnorm TWO-PASS (análise → render com measured_*)
 *   - Pós-validação automática (LUFS ±0.1 LU, TP +0.05 dB)
 *   - Fallback conservador (1 tentativa com -0.2 dB ceiling)
 * 
 * Uso:
 *   node automaster-v1.cjs <input.wav> <output.wav> <genreKey> <mode>
 *
 * Exemplo:
 *   node automaster-v1.cjs input.wav output.wav funk_bruxaria STREAMING
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execFileAsync = promisify(execFile);

// ============================================================
// DECISION ENGINE - Motor de decisão baseado em métricas
// Targets agora são calculados pelo decision-engine.js no backend
// ============================================================

// ============================================================
// CONSTANTES
// ============================================================

// Tolerâncias de validação
const LUFS_TOLERANCE = 0.2;  // ±0.2 LU (padrão prático profissional)
const TP_TOLERANCE = 0.05;   // +0.05 dB

// Scripts do projeto
const MEASURE_SCRIPT = path.resolve(__dirname, 'measure-audio.cjs');
const FIX_TP_SCRIPT = path.resolve(__dirname, 'fix-true-peak.cjs');

// ============================================================
// VALIDAÇÃO DE PARÂMETROS
// ============================================================

function validateArgs() {
  const args = process.argv.slice(2);

  // Aceitar: input, output, mode, targetLUFS
  if (args.length < 4) {
    throw new Error('Numero incorreto de argumentos. Uso: node automaster-v1.cjs <input.wav> <output.wav> <mode> <targetLUFS>');
  }

  const [inputPath, outputPath, mode, targetLufsStr] = args;

  // Validar arquivo de entrada
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo de entrada nao encontrado: ${inputPath}`);
  }

  // Validar extensão de entrada
  const inputExt = path.extname(inputPath).toLowerCase();
  if (inputExt !== '.wav') {
    throw new Error(`Arquivo de entrada deve ser WAV (recebido: ${inputExt})`);
  }

  // Validar extensão de saída
  const outputExt = path.extname(outputPath).toLowerCase();
  if (outputExt !== '.wav') {
    throw new Error(`Arquivo de saida deve ser WAV (recebido: ${outputExt})`);
  }
  
  // Validar targetLUFS
  const targetLufs = parseFloat(targetLufsStr);
  if (isNaN(targetLufs) || targetLufs < -30 || targetLufs > -5) {
    throw new Error(`Target LUFS invalido: ${targetLufsStr}. Deve ser entre -30 e -5`);
  }

  // Ceiling fixo padrão para evitar clipping
  const ceilingDbtp = -1.0; // True Peak ceiling padrão

  return {
    inputPath: path.resolve(inputPath),
    outputPath: path.resolve(outputPath),
    mode: (mode || 'MEDIUM').toUpperCase(),
    targetLufs: targetLufs,
    ceilingDbtp: ceilingDbtp
  };
}

// ============================================================
// VERIFICAÇÃO DE FFMPEG
// ============================================================

function checkFFmpeg() {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-version'], (error, stdout) => {
      if (error) {
        reject(new Error('FFmpeg não encontrado. Instale FFmpeg e adicione ao PATH.'));
        return;
      }
      
      const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'desconhecida';
      resolve(version);
    });
  });
}

// ============================================================
// PROCESSAMENTO DE MASTERIZAÇÃO (TWO-PASS)
// ============================================================

/**
 * Converte dBTP para valor linear (para alimiter)
 */
function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

/**
 * Extrai JSON do stderr do FFmpeg loudnorm
 */
function extractLoudnormJson(stderr) {
  // loudnorm imprime JSON entre chaves
  const match = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!match) {
    throw new Error('Não foi possível extrair JSON do loudnorm');
  }
  return JSON.parse(match[0]);
}

/**
 * Mede LUFS e True Peak usando o script oficial do projeto (measure-audio.cjs).
 * Mais confiável que loudnorm JSON para True Peak final.
 */
async function measureWithOfficialScript(filePath) {
  try {
    const { stdout } = await execFileAsync('node', [MEASURE_SCRIPT, filePath], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000
    });
    const data = JSON.parse(stdout.trim());
    if (typeof data.lufs_i !== 'number' || typeof data.true_peak_db !== 'number') {
      throw new Error('Formato inválido retornado por measure-audio.cjs');
    }
    return data;
  } catch (error) {
    throw new Error(`Erro ao medir com measure-audio.cjs: ${error.message}`);
  }
}

/**
 * Aplica fix de True Peak usando fix-true-peak.cjs.
 * Cria arquivo _safe.wav e o move para outputPath.
 */
async function applyTruePeakFix(outputPath) {
  const debug = process.env.DEBUG_PIPELINE === 'true';
  
  try {
    const { stdout } = await execFileAsync('node', [FIX_TP_SCRIPT, outputPath], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000
    });
    
    const result = JSON.parse(stdout.trim());
    
    if (result.status === 'OK') {
      // Já estava dentro do limite
      if (debug) console.error('[DEBUG] fix-true-peak: já estava OK');
      return { fixed: false, tp_before: result.input_tp };
    }
    
    if (result.status === 'FIXED') {
      // Fix aplicado - arquivo _safe.wav foi criado
      const outputDir = path.dirname(outputPath);
      const safePath = path.join(outputDir, result.output_file);
      
      if (!fs.existsSync(safePath)) {
        throw new Error(`Arquivo corrigido não encontrado: ${safePath}`);
      }
      
      // Mover _safe.wav de volta para outputPath original
      fs.renameSync(safePath, outputPath);
      
      if (debug) {
        console.error(`[DEBUG] fix-true-peak: aplicado gain ${result.applied_gain_db} dB`);
      }
      
      return {
        fixed: true,
        tp_before: result.input_tp,
        gain_applied: result.applied_gain_db
      };
    }
    
    throw new Error(`fix-true-peak retornou status inesperado: ${result.status}`);
    
  } catch (error) {
    throw new Error(`Erro ao aplicar fix-true-peak: ${error.message}`);
  }
}

/**
 * Deteta o sample rate do arquivo de entrada.
 */
async function detectInputSampleRate(inputPath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=sample_rate',
      '-of', 'json',
      inputPath
    ], { maxBuffer: 10 * 1024 * 1024, timeout: 10000 });
    
    const data = JSON.parse(stdout);
    const sampleRate = parseInt(data.streams[0].sample_rate, 10);
    
    if (isNaN(sampleRate) || sampleRate <= 0) {
      throw new Error('Sample rate inválido');
    }
    
    return sampleRate;
  } catch (error) {
    throw new Error(`Erro ao detectar sample rate: ${error.message}`);
  }
}

/**
 * Detecta o ponto onde a música realmente começa (ignora introduções silenciosas).
 * 
 * Problema resolvido:
 * - Evita que loudnorm meça LUFS muito baixo em intros silenciosas
 * - Previne salto de volume quando o beat entra
 * - Melhora estabilidade da medição de loudness
 * 
 * @param {string} inputPath - Caminho do arquivo de entrada
 * @returns {Promise<number>} - Tempo em segundos onde o áudio efetivo começa (0-3s)
 */
async function detectEffectiveStartTime(inputPath) {
  return new Promise((resolve, reject) => {
    // Usar silencedetect para encontrar quando o áudio passa de -45 dBFS
    // noise=-45dB significa: considerar silêncio tudo abaixo deste nível
    // duration=0.1 significa: precisa de 0.1s de áudio acima do limiar
    const args = [
      '-i', inputPath,
      '-af', 'silencedetect=noise=-45dB:duration=0.1',
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', args, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stderr) {
        // Se falhar, retornar 0 (usar áudio completo)
        resolve(0);
        return;
      }

      try {
        // Procurar por "silence_end" no stderr
        // Ex: [silencedetect @ ...] silence_end: 1.23 | silence_duration: 1.23
        const silenceEndMatch = stderr.match(/silence_end:\s*([\d.]+)/);
        
        if (silenceEndMatch) {
          const silenceEnd = parseFloat(silenceEndMatch[1]);
          
          // Limitar entre 0 e 3 segundos
          // Se silêncio termina após 3s, ignorar (provável false positive)
          if (silenceEnd > 0 && silenceEnd <= 3) {
            resolve(silenceEnd);
            return;
          }
        }
        
        // Se não detectou silêncio ou está fora do range, retornar 0
        resolve(0);
      } catch (parseError) {
        // Em caso de erro no parse, usar áudio completo
        resolve(0);
      }
    });
  });
}

/**
 * PASSO 1: Análise do áudio (loudnorm first pass)
 * 
 * Melhorias de estabilidade:
 * - Aceita effectiveStartTime para ignorar introduções silenciosas
 * - Usa highpass=40Hz para reduzir influência de subgrave na medição
 * - NÃO altera o render final (highpass só na análise)
 */
function analyzeLoudness(inputPath, targetI, targetTP, targetLRA, effectiveStartTime = 0) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath
    ];
    
    // Se detectou intro silenciosa, começar medição a partir do tempo efetivo
    if (effectiveStartTime > 0) {
      args.push('-ss', effectiveStartTime.toFixed(3));
    }
    
    // Construir filtro de análise:
    // 0. Pre-limiter de estabilização (-2dB = 0.794 linear, não altera loudness)
    // 1. highpass=40Hz (reduz influência de subgrave)
    // 2. loudnorm (medição)
    const preLimiter = 'alimiter=limit=0.794:level=disabled';
    const analysisFilter = `${preLimiter},highpass=f=40,loudnorm=I=${targetI}:TP=${targetTP}:LRA=${targetLRA}:print_format=json`;
    
    args.push(
      '-af', analysisFilter,
      '-f', 'null',
      '-'
    );

    execFile('ffmpeg', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      try {
        const data = extractLoudnormJson(stderr);
        
        // Validar campos obrigatórios
        const required = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'];
        for (const field of required) {
          if (data[field] === undefined) {
            reject(new Error(`Campo obrigatório ausente no loudnorm: ${field}`));
            return;
          }
        }

        resolve({
          input_i: parseFloat(data.input_i),
          input_tp: parseFloat(data.input_tp),
          input_lra: parseFloat(data.input_lra),
          input_thresh: parseFloat(data.input_thresh),
          target_offset: parseFloat(data.target_offset)
        });
      } catch (parseError) {
        reject(new Error(`Erro ao parsear loudnorm: ${parseError.message}\nStderr: ${stderr}`));
      }
    });
  });
}

// ============================================================
// ANÁLISE ESPECTRAL DE RISCO (EQ DEFENSIVO)
// ============================================================

/**
 * Calcula mediana de um array (ignora outliers).
 * @param {number[]} arr
 * @returns {number}
 */
function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Calcula média de um array.
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Limita valor dentro de um range (evita deltas irreais).
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Estima confiança na análise espectral baseada em variância e riskRatio.
 * 
 * CRITÉRIOS V4:
 * - HIGH: baixa variância + alto riskRatio (risco consistente)
 * - MEDIUM: variância média ou riskRatio médio
 * - LOW: variância extrema ou janelas insuficientes
 * 
 * AJUSTE V4: Thresholds mais tolerantes para música real
 * 
 * @param {Object} stats - { subVariance, presenceVariance, subRiskRatio, presenceRiskRatio, validWindows }
 * @returns {string} - "HIGH" | "MEDIUM" | "LOW"
 */
function estimateSpectralConfidence(stats) {
  const { subVariance, presenceVariance, subRiskRatio, presenceRiskRatio, validWindows } = stats;
  
  // Poucas janelas = dados insuficientes
  if (validWindows < 10) {
    return 'LOW';
  }
  
  // Variância EXTREMA = música muito instável (não tomar decisão)
  // Threshold V4: 120.0 (música com dinâmica extrema ou corrupta)
  if (subVariance > 120.0 || presenceVariance > 120.0) {
    return 'LOW';
  }
  
  // Alto riskRatio + baixa variância = confiança alta
  // Threshold V4: variance < 60 (era 30 na V3)
  const avgRiskRatio = (subRiskRatio + presenceRiskRatio) / 2;
  if (avgRiskRatio > 0.3 && subVariance < 60.0 && presenceVariance < 60.0) {
    return 'HIGH';
  }
  
  // Caso padrão
  return 'MEDIUM';
}

/**
 * Analisa riscos espectrais que causam problemas técnicos no loudnorm.
 * 
 * OBJETIVO:
 * - Detectar subgrave excessivo (causa pumping)
 * - Detectar harshness extremo (causa overshoot perceptivo)
 * 
 * BLINDAGEM V4 (ESTABILIDADE ESTATÍSTICA):
 * - Análise em janelas de 2 segundos (não blocos fixos)
 * - Estatísticas globais: median, mean, variance, riskRatio
 * - Exige mínimo 10 janelas válidas
 * - Ignora janelas com energia muito baixa (< -50 LUFS estimado)
 * - Confidence score baseado em variance < 120 dB²
 * - Decisão robusta: riskRatio >= 0.25 + medianDelta > threshold + variance < 60
 * 
 * NÃO É:
 * - EQ artístico/criativo
 * - "Melhorador" de som
 * - Alteração de balanço tonal
 * 
 * É APENAS:
 * - Guardrail técnico para estabilizar loudnorm
 * 
 * @param {string} inputPath - Caminho do arquivo de entrada
 * @param {number|null} inputLoudness - LUFS do input (para bypass de silêncio)
 * @returns {Promise<Object>} - { subDominant, harsh, stats, confidence, bypassed, bypassReason }
 */
async function analyzeSpectralRisk(inputPath, inputLoudness = null) {
  return new Promise((resolve, reject) => {
    // PROTEÇÃO V4: Se loudness integrado disponível e indica silêncio extremo, bypassar
    // Threshold: < -40 LUFS = intro silenciosa, ruído de fundo, ou arquivo corrompido
    if (inputLoudness !== null && inputLoudness < -40.0) {
      resolve({
        subDominant: false,
        harsh: false,
        stats: {
          sub: { median: 0, mean: 0, variance: 0, riskRatio: 0 },
          presence: { median: 0, mean: 0, variance: 0, riskRatio: 0 },
          windows: {
            valid: 0,
            total: 0
          },
          rms: {
            sub: -70,
            body: -70,
            presence: -70
          }
        },
        confidence: 'LOW',
        bypassed: true,
        bypassReason: 'silence_detected_by_loudness'
      });
      return;
    }

    // ANÁLISE TEMPORAL V4 COM JANELAS DE 2 SEGUNDOS
    // Obter duração do arquivo
    execFile('ffprobe', ['-i', inputPath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0'], 
      { timeout: 30000 }, (durationError, durationStdout, durationStderr) => {
        if (durationError) {
          // Fallback: usar análise single-frame
          analyzeSingleFrame();
          return;
        }
        
        const duration = parseFloat(durationStdout.trim());
        if (isNaN(duration) || duration <= 0) {
          analyzeSingleFrame();
          return;
        }
        
        // DIVIDIR EM JANELAS DE 2 SEGUNDOS
        const WINDOW_SIZE = 2.0; // segundos
        const MIN_WINDOWS = 10;
        const SILENCE_THRESHOLD = -50.0; // dBFS estimado (RMS médio das bandas)
        
        const numWindows = Math.floor(duration / WINDOW_SIZE);
        
        if (numWindows < MIN_WINDOWS) {
          // Música muito curta, usar análise single-frame
          analyzeSingleFrame();
          return;
        }
        
        const windowResults = [];
        let processedWindows = 0;
        
        // Analisar cada janela
        for (let i = 0; i < numWindows; i++) {
          const startTime = i * WINDOW_SIZE;
          analyzeWindow(i, startTime, WINDOW_SIZE);
        }
        
        function analyzeWindow(windowIndex, start, windowDur) {
          // Análise SUB para esta janela
          const subArgs = [
            '-ss', start.toString(),
            '-t', windowDur.toString(),
            '-i', inputPath,
            '-af', 'bandpass=f=50:width_type=h:w=60,astats=reset=1',
            '-f', 'null',
            '-'
          ];
          
          execFile('ffmpeg', subArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (subError, subStdout, subStderr) => {
            if (subError && !subStderr) {
              windowResults[windowIndex] = null;
              checkCompletion();
              return;
            }
            
            let subRms = -70;
            const subRmsMatch = subStderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
            if (subRmsMatch) {
              subRms = parseFloat(subRmsMatch[1]);
            }
            
            // Análise BODY
            const bodyArgs = [
              '-ss', start.toString(),
              '-t', windowDur.toString(),
              '-i', inputPath,
              '-af', 'bandpass=f=260:width_type=h:w=280,astats=reset=1',
              '-f', 'null',
              '-'
            ];
            
            execFile('ffmpeg', bodyArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (bodyError, bodyStdout, bodyStderr) => {
              if (bodyError && !bodyStderr) {
                windowResults[windowIndex] = null;
                checkCompletion();
                return;
              }
              
              let bodyRms = -70;
              const bodyRmsMatch = bodyStderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
              if (bodyRmsMatch) {
                bodyRms = parseFloat(bodyRmsMatch[1]);
              }
              
              // Análise PRESENCE
              const presenceArgs = [
                '-ss', start.toString(),
                '-t', windowDur.toString(),
                '-i', inputPath,
                '-af', 'bandpass=f=5500:width_type=h:w=5000,astats=reset=1',
                '-f', 'null',
                '-'
              ];
              
              execFile('ffmpeg', presenceArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (presenceError, presenceStdout, presenceStderr) => {
                if (presenceError && !presenceStderr) {
                  windowResults[windowIndex] = null;
                  checkCompletion();
                  return;
                }
                
                let presenceRms = -70;
                const presenceRmsMatch = presenceStderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
                if (presenceRmsMatch) {
                  presenceRms = parseFloat(presenceRmsMatch[1]);
                }
                
                // Estimar loudness da janela (média das bandas)
                const estimatedLoudness = (subRms + bodyRms + presenceRms) / 3.0;
                
                // FILTRAR JANELAS SILENCIOSAS (< -50 dBFS)
                if (estimatedLoudness < SILENCE_THRESHOLD) {
                  windowResults[windowIndex] = null; // Janela silenciosa, ignorar
                  checkCompletion();
                  return;
                }
                
                // Calcular deltas CLAMPADOS (V4 - evita valores irreais)
                let subDelta = subRms - bodyRms;
                let presenceDelta = presenceRms - bodyRms;
                
                subDelta = clamp(subDelta, -20, +10);
                presenceDelta = clamp(presenceDelta, -20, +10);
                
                windowResults[windowIndex] = {
                  subRms,
                  bodyRms,
                  presenceRms,
                  subDelta,
                  presenceDelta,
                  estimatedLoudness
                };
                
                checkCompletion();
              });
            });
          });
        }
        
        function checkCompletion() {
          processedWindows++;
          
          if (processedWindows === numWindows) {
            // Filtrar janelas válidas
            const validWindows = windowResults.filter(w => w !== null);
            
            // EXIGIR MÍNIMO 10 JANELAS VÁLIDAS
            if (validWindows.length < MIN_WINDOWS) {
              // Dados insuficientes, usar fallback
              analyzeSingleFrame();
              return;
            }
            
            // COLETAR DELTAS
            const subDeltas = [];
            const presenceDeltas = [];
            let subRmsSum = 0;
            let bodyRmsSum = 0;
            let presenceRmsSum = 0;
            
            for (const window of validWindows) {
              subDeltas.push(window.subDelta);
              presenceDeltas.push(window.presenceDelta);
              subRmsSum += window.subRms;
              bodyRmsSum += window.bodyRms;
              presenceRmsSum += window.presenceRms;
            }
            
            // CALCULAR ESTATÍSTICAS GLOBAIS V4
            const subMedian = median(subDeltas);
            const subMean = mean(subDeltas);
            const presenceMedian = median(presenceDeltas);
            const presenceMean = mean(presenceDeltas);
            
            // Variância
            const subVariance = subDeltas.reduce((sum, d) => sum + Math.pow(d - subMean, 2), 0) / subDeltas.length;
            const presenceVariance = presenceDeltas.reduce((sum, d) => sum + Math.pow(d - presenceMean, 2), 0) / presenceDeltas.length;
            
            // RISK RATIO V4 (% de janelas que violam threshold)
            const subRiskWindows = subDeltas.filter(d => d > -5.0).length;
            const presenceRiskWindows = presenceDeltas.filter(d => d > -3.0).length;
            
            const subRiskRatio = subRiskWindows / validWindows.length;
            const presenceRiskRatio = presenceRiskWindows / validWindows.length;
            
            // SCORE DE CONFIANÇA V4
            const confidence = estimateSpectralConfidence({
              subVariance,
              presenceVariance,
              subRiskRatio,
              presenceRiskRatio,
              validWindows: validWindows.length
            });
            
            // DECISÃO FINAL V4 (COM NOVA REGRA)
            // Aplicar EQ apenas se TODAS condições:
            // - riskRatio >= 0.25
            // - medianDelta > threshold
            // - variance < 60
            // - confidence != LOW (ou riskRatio > 0.6 para EQ leve)
            const MIN_RISK_RATIO = 0.25;
            const MAX_VARIANCE = 60.0;
            
            let subDominant = false;
            let harsh = false;
            
            // Sub dominante
            if (subMedian > -5.0 && subRiskRatio >= MIN_RISK_RATIO && subVariance < MAX_VARIANCE) {
              subDominant = true;
            }
            
            // Harsh (V4 ajustado: -6 dB ao invés de -3 dB)
            // Testes reais: presença -5.66 dB era estridente mas não detectada (-5.0 muito restritivo)
            if (presenceMedian > -6.0 && presenceRiskRatio >= MIN_RISK_RATIO && presenceVariance < MAX_VARIANCE) {
              harsh = true;
            }
            
            // Médias de RMS
            const avgSubRms = subRmsSum / validWindows.length;
            const avgBodyRms = bodyRmsSum / validWindows.length;
            const avgPresenceRms = presenceRmsSum / validWindows.length;
            
            resolve({
              subDominant,
              harsh,
              stats: {
                sub: {
                  median: subMedian,
                  mean: subMean,
                  variance: subVariance,
                  riskRatio: subRiskRatio
                },
                presence: {
                  median: presenceMedian,
                  mean: presenceMean,
                  variance: presenceVariance,
                  riskRatio: presenceRiskRatio
                },
                windows: {
                  valid: validWindows.length,
                  total: numWindows
                },
                rms: {
                  sub: avgSubRms,
                  body: avgBodyRms,
                  presence: avgPresenceRms
                }
              },
              confidence,
              bypassed: false
            });
          }
        }
      });
    
    // Fallback: análise single-frame (se multi-frame falhar)
    function analyzeSingleFrame() {
      const subArgs = [
        '-i', inputPath,
        '-af', 'bandpass=f=50:width_type=h:w=60,astats=reset=1',
        '-f', 'null',
        '-'
      ];
      
      execFile('ffmpeg', subArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (subError, subStdout, subStderr) => {
        if (subError && !subStderr) {
          reject(new Error(`Erro ao analisar subgrave: ${subError.message}`));
          return;
        }
        
        let subRms = -70;
        const subRmsMatch = subStderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
        if (subRmsMatch) {
          subRms = parseFloat(subRmsMatch[1]);
        }
        
        const bodyArgs = [
          '-i', inputPath,
          '-af', 'bandpass=f=260:width_type=h:w=280,astats=reset=1',
          '-f', 'null',
          '-'
        ];
        
        execFile('ffmpeg', bodyArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (bodyError, bodyStdout, bodyStderr) => {
          if (bodyError && !bodyStderr) {
            reject(new Error(`Erro ao analisar corpo: ${bodyError.message}`));
            return;
          }
          
          let bodyRms = -70;
          const bodyRmsMatch = bodyStderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
          if (bodyRmsMatch) {
            bodyRms = parseFloat(bodyRmsMatch[1]);
          }
          
          const presenceArgs = [
            '-i', inputPath,
            '-af', 'bandpass=f=5500:width_type=h:w=5000,astats=reset=1',
            '-f', 'null',
            '-'
          ];
          
          execFile('ffmpeg', presenceArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (presenceError, presenceStdout, presenceStderr) => {
            if (presenceError && !presenceStderr) {
              reject(new Error(`Erro ao analisar presença: ${presenceError.message}`));
              return;
            }
            
            let presenceRms = -70;
            const presenceRmsMatch = presenceStderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
            if (presenceRmsMatch) {
              presenceRms = parseFloat(presenceRmsMatch[1]);
            }
            
            let subDelta = subRms - bodyRms;
            let presenceDelta = presenceRms - bodyRms;
            
            subDelta = clamp(subDelta, -20, +10);
            presenceDelta = clamp(presenceDelta, -20, +10);
            
            const subDominant = (subDelta > -5.0);
            const harsh = (presenceDelta > -3.0);
            
            resolve({
              subDominant,
              harsh,
              stats: {
                sub: {
                  median: subDelta,
                  mean: subDelta,
                  variance: 0,
                  riskRatio: subDominant ? 1.0 : 0.0
                },
                presence: {
                  median: presenceDelta,
                  mean: presenceDelta,
                  variance: 0,
                  riskRatio: harsh ? 1.0 : 0.0
                },
                windows: {
                  valid: 1,
                  total: 1
                },
                rms: {
                  sub: subRms,
                  body: bodyRms,
                  presence: presenceRms
                }
              },
              confidence: 'MEDIUM',
              bypassed: false
            });
          });
        });
      });
    }
  });
}

/**
 * ClassifyMixIntegrity - Classificador de qualidade da mix pré-masterização
 * 
 * OBJETIVO: Detectar problemas estruturais da mixagem ANTES da masterização:
 * - Subgrave excessivo (> 45% da energia total)
 * - Crest factor baixo (< 6 dB = mix já comprimida)
 * - RMS variance alta nos drops (dinâmica inconsistente)
 * 
 * CLASSIFICAÇÃO:
 * - riskScore 0 → "OK" = mix íntegra, pode masterizar normalmente
 * - riskScore 1 → "RISKY" = problemas leves, reduzir target em 1.5 LU
 * - riskScore >= 2 → "POOR" = problemas severos, reduzir target em 3.0 LU
 * 
 * @param {string} inputPath - Caminho do arquivo de áudio
 * @returns {Promise<Object>} - { integrity, riskScore, subRatio, crestFactor }
 */
async function classifyMixIntegrity(inputPath) {
  return new Promise((resolve, reject) => {
    // Passo 0: Obter duração do arquivo
    execFile('ffprobe', ['-i', inputPath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0'], 
      { timeout: 30000 }, (durationError, durationStdout, durationStderr) => {
        
        let duration = 0;
        if (!durationError && durationStdout) {
          duration = parseFloat(durationStdout.trim());
          if (isNaN(duration)) duration = 0;
        }
        
        // Passo 1: Calcular energia no SUB (< 120 Hz) e TOTAL (banda completa)
        const subArgs = [
          '-i', inputPath,
          '-af', 'lowpass=f=120,astats=reset=1',
          '-f', 'null',
          '-'
        ];
        
        execFile('ffmpeg', subArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (subError, subStdout, subStderr) => {
      if (subError && !subStderr) {
        reject(new Error(`Erro ao analisar subgrave (<120Hz): ${subError.message}`));
        return;
      }
      
      // Extrair RMS level do sub
      let subRms = -70;
      const subRmsMatch = subStderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
      if (subRmsMatch) {
        subRms = parseFloat(subRmsMatch[1]);
      }
      
      // Passo 2: Calcular energia TOTAL (banda completa) e crest factor
      const totalArgs = [
        '-i', inputPath,
        '-af', 'astats=reset=1',
        '-f', 'null',
        '-'
      ];
      
      execFile('ffmpeg', totalArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (totalError, totalStdout, totalStderr) => {
        if (totalError && !totalStderr) {
          reject(new Error(`Erro ao analisar banda completa: ${totalError.message}`));
          return;
        }
        
        // Extrair RMS e Peak para calcular crest factor
        let totalRms = -70;
        let totalPeak = -70;
        
        const totalRmsMatch = totalStderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
        if (totalRmsMatch) {
          totalRms = parseFloat(totalRmsMatch[1]);
        }
        
        const totalPeakMatch = totalStderr.match(/Peak level dB:\s*(-?\d+\.\d+)/);
        if (totalPeakMatch) {
          totalPeak = parseFloat(totalPeakMatch[1]);
        }
        
        // Crest Factor = Peak - RMS (em dB)
        const crestFactor = totalPeak - totalRms;
        
        // Passo 3: Calcular subRatio (energia sub / energia total)
        // subRatio = 10^((subRms - totalRms) / 10)
        // Simplificação: usar diferença dB como proxy
        const subDelta = subRms - totalRms;
        
        // Se sub está apenas 3 dB abaixo do total, representa ~50% da energia
        // Se sub está 6 dB abaixo, representa ~25% da energia
        // Se sub está 10 dB abaixo, representa ~10% da energia
        // Formula aproximada: subRatio = 10^(delta/10)
        let subRatio = Math.pow(10, subDelta / 10);
        subRatio = clamp(subRatio, 0, 1);
        
        // Passo 4: Detectar RMS variance alta (análise de janelas nos drops)
        // Se música é curta (< 60s), não há drop típico, usar análise simplificada
        let rmsVarianceHigh = false;
        
        if (duration >= 60) {
          // Analisar 3 janelas de 4s cada no drop (assumir drop após 40% da música)
          const dropStart = duration * 0.4;
          const windowSize = 4.0;
          const numWindows = 3;
          
          const windowRmsValues = [];
          let windowsProcessed = 0;
          
          for (let i = 0; i < numWindows; i++) {
            const start = dropStart + (i * windowSize);
            
            const windowArgs = [
              '-ss', start.toString(),
              '-t', windowSize.toString(),
              '-i', inputPath,
              '-af', 'astats=reset=1',
              '-f', 'null',
              '-'
            ];
            
            execFile('ffmpeg', windowArgs, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (winError, winStdout, winStderr) => {
              let windowRms = -70;
              
              if (!winError || winStderr) {
                const winRmsMatch = winStderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
                if (winRmsMatch) {
                  windowRms = parseFloat(winRmsMatch[1]);
                }
              }
              
              windowRmsValues.push(windowRms);
              windowsProcessed++;
              
              if (windowsProcessed === numWindows) {
                // Calcular variance das janelas
                const meanRms = windowRmsValues.reduce((sum, v) => sum + v, 0) / windowRmsValues.length;
                const variance = windowRmsValues.reduce((sum, v) => sum + Math.pow(v - meanRms, 2), 0) / windowRmsValues.length;
                
                // Variance > 4.0 dB² indica dinâmica inconsistente
                rmsVarianceHigh = variance > 4.0;
                
                // Finalizar classificação
                finishClassification(subRatio, crestFactor, rmsVarianceHigh);
              }
            });
          }
        } else {
          // Música curta: variance não aplicável
          rmsVarianceHigh = false;
          finishClassification(subRatio, crestFactor, rmsVarianceHigh);
        }
        
        function finishClassification(subRatio, crestFactor, rmsVarianceHigh) {
          // Passo 5: Aplicar regras de riskScore
          let riskScore = 0;
          
          if (subRatio > 0.45) riskScore++;       // Subgrave excessivo
          if (crestFactor < 6) riskScore++;       // Mix já comprimida
          if (rmsVarianceHigh) riskScore++;       // Dinâmica inconsistente
          
          // Passo 6: Classificar integridade
          let integrity = 'OK';
          if (riskScore === 1) {
            integrity = 'RISKY';
          } else if (riskScore >= 2) {
            integrity = 'POOR';
          }
          
          resolve({
            integrity,
            riskScore,
            subRatio,
            crestFactor,
            rmsVarianceHigh
          });
        }
      });
    });
      }); // Fechar callback do ffprobe (duração)
  });
}

/**
 * Mede a quantidade média de gain reduction aplicada pelo limiter final.
 * 
 * OBJETIVO: Detectar over-limiting que pode destruir dinâmica e causar distorção.
 * 
 * Se limiterGR > 5 dB médio → limiter está trabalhando demais (pumping audível)
 * 
 * @param {string} audioPath - Caminho do arquivo masterizado
 * @returns {Promise<number>} - Gain reduction médio em dB (positivo)
 */
async function measureLimiterGainReduction(audioPath) {
  return new Promise((resolve, reject) => {
    // Usar astats para medir Peak e RMS
    const args = [
      '-i', audioPath,
      '-af', 'astats=reset=1',
      '-f', 'null',
      '-'
    ];
    
    execFile('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stderr) {
        reject(new Error(`Erro ao medir limiter GR: ${error.message}`));
        return;
      }
      
      try {
        // Extrair Peak dBFS e RMS dBFS
        const peakMatch = stderr.match(/Peak level dB:\s*(-?\d+\.\d+)/);
        const rmsMatch = stderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
        
        if (!peakMatch || !rmsMatch) {
          // Fallback: assumir GR moderado
          resolve(2.0);
          return;
        }
        
        const peakDb = parseFloat(peakMatch[1]);
        const rmsDb = parseFloat(rmsMatch[1]);
        
        // Estimar GR: diferença entre onde o limiter começou a atuar e o peak final
        // Peak próximo de 0 dBFS indica limiting agressivo
        // Se peak = -0.5 dBTP e RMS = -10 dBFS → crest = 9.5 dB (OK)
        // Se peak = -0.5 dBTP e RMS = -6 dBFS → crest = 5.5 dB (over-limited)
        const crestFactor = peakDb - rmsDb;
        
        // GR estimado: quanto o limiter "comeu" da dinâmica
        // Crest < 6 dB indica compressão/limiting excessivo
        let estimatedGR = 0;
        if (crestFactor < 6) {
          estimatedGR = 6 - crestFactor; // Ex: crest=4 → GR=2 dB
        }
        
        resolve(estimatedGR);
      } catch (err) {
        reject(new Error(`Erro ao parsear limiter GR: ${err.message}`));
      }
    });
  });
}

/**
 * Mede o crest factor final do áudio masterizado.
 * 
 * OBJETIVO: Detectar "brick-wall" (crest collapse) causado por over-mastering.
 * 
 * - Crest >= 8 dB → Dinâmica saudável (música acústica, jazz)
 * - Crest 6-8 dB → Dinâmica adequada (pop, rock moderno)
 * - Crest < 5 dB → Over-compressed (loudness war, pumping audível)
 * 
 * @param {string} audioPath - Caminho do arquivo masterizado
 * @returns {Promise<number>} - Crest factor em dB
 */
async function measureFinalCrest(audioPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', audioPath,
      '-af', 'astats=reset=1',
      '-f', 'null',
      '-'
    ];
    
    execFile('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stderr) {
        reject(new Error(`Erro ao medir crest final: ${error.message}`));
        return;
      }
      
      try {
        const peakMatch = stderr.match(/Peak level dB:\s*(-?\d+\.\d+)/);
        const rmsMatch = stderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
        
        if (!peakMatch || !rmsMatch) {
          // Fallback: assumir crest moderado
          resolve(6.5);
          return;
        }
        
        const peakDb = parseFloat(peakMatch[1]);
        const rmsDb = parseFloat(rmsMatch[1]);
        const crestFactor = peakDb - rmsDb;
        
        resolve(crestFactor);
      } catch (err) {
        reject(new Error(`Erro ao parsear crest final: ${err.message}`));
      }
    });
  });
}

/**
 * Estima o impacto tonal audível dos filtros EQ.
 * 
 * CLASSIFICAÇÃO:
 * - none: Zero filtros (bypass)
 * - low: 1-2 filtros leves (imperceptível)
 * - medium: 3+ filtros ou cortes agressivos (perceptível)
 * 
 * @param {Array<string>} filters - Array de strings de filtros
 * @returns {Object} - { level: string, totalCutDb: number }
 */
function estimateTonalImpact(filters) {
  if (!filters || filters.length === 0) {
    return { level: 'none', totalCutDb: 0 };
  }

  // Calcular corte total (soma dos ganhos negativos)
  let totalCutDb = 0;
  
  for (const filter of filters) {
    // Extrair ganho de equalizer (ex: g=-1.5)
    const gainMatch = filter.match(/g=(-?\d+\.?\d*)/);
    if (gainMatch) {
      const gain = parseFloat(gainMatch[1]);
      if (gain < 0) {
        totalCutDb += Math.abs(gain);
      }
    }
  }

  // Classificar impacto
  let level = 'none';
  
  if (filters.length === 0) {
    level = 'none';
  } else if (filters.length <= 2 && totalCutDb <= 2.0) {
    level = 'low';
  } else if (filters.length <= 3 && totalCutDb <= 4.0) {
    level = 'low';
  } else {
    level = 'medium';
  }

  return { level, totalCutDb };
}

/**
 * Constrói filtros de EQ defensivo baseados na análise de risco.
 * 
 * REGRAS V2 (BLINDADAS):
 * - Máximo 3 filtros
 * - Corte total máximo de -3 dB (limitador de impacto tonal)
 * - NUNCA altera médios/graves principais
 * - Bypass se nenhum risco detectado
 * 
 * @param {Object} spectralRisk - Resultado de analyzeSpectralRisk()
 * @returns {Object|null} - { filters: string, impact: Object } ou null se não necessário
 */
function buildDefensiveEQFilters(spectralRisk) {
  const { subDominant, harsh, confidence } = spectralRisk;

  // PROTEÇÃO V4: Se confiança baixa (música instável)
  if (confidence === 'LOW') {
    // Mas se riskRatio alto (> 0.6), aplicar EQ leve (apenas 1 filtro)
    const stats = spectralRisk.stats || {};
    const subRiskRatio = stats.sub?.riskRatio || 0;
    const presenceRiskRatio = stats.presence?.riskRatio || 0;
    const maxRiskRatio = Math.max(subRiskRatio, presenceRiskRatio);
    
    if (maxRiskRatio > 0.6) {
      // Aplicar apenas 1 filtro no problema mais crítico
      if (subDominant && subRiskRatio >= presenceRiskRatio) {
        // EQ leve em subgrave: apenas highpass suave
        return {
          filters: 'highpass=f=28:poles=2',
          impact: {
            level: 'low',
            totalCutDb: 0, // Highpass não tem ganho negativo direto
            affectedBands: ['sub']
          }
        };
      } else if (harsh && presenceRiskRatio > subRiskRatio) {
        // EQ leve em presença: corte reduzido
        return {
          filters: 'equalizer=f=4800:t=q:w=1.0:g=-1.0',
          impact: {
            level: 'low',
            totalCutDb: 1.0,
            affectedBands: ['presence']
          }
        };
      } else if (subDominant) {
        // Fallback: sub detectado mas presença não
        return {
          filters: 'highpass=f=28:poles=2',
          impact: {
            level: 'low',
            totalCutDb: 0,
            affectedBands: ['sub']
          }
        };
      } else if (harsh) {
        // Fallback: presença detectada mas sub não
        return {
          filters: 'equalizer=f=4800:t=q:w=1.0:g=-1.0',
          impact: {
            level: 'low',
            totalCutDb: 1.0,
            affectedBands: ['presence']
          }
        };
      }
    }
    
    // Senão, bypass (riskRatio baixo + confidence LOW = dados insuficientes)
    return null;
  }

  const filters = [];

  // Filtro 1: Subgrave excessivo
  if (subDominant) {
    // Highpass suave em 28 Hz (poles 2 = 12 dB/oct)
    filters.push('highpass=f=28:poles=2');
    // Corte adicional em 55 Hz (Q 1.2 = relativamente largo)
    filters.push('equalizer=f=55:t=q:w=1.2:g=-1.5');
  }

  // Filtro 2: Harshness excessivo
  if (harsh) {
    // Corte em 4.8 kHz (Q 1.0 = médio)
    filters.push('equalizer=f=4800:t=q:w=1.0:g=-1.5');
  }

  // Se nenhum filtro, retornar null (bypass)
  if (filters.length === 0) {
    return null;
  }

  // Garantir máximo de 3 filtros (proteção adicional)
  // Prioridade: sub > harsh
  if (filters.length > 3) {
    filters = filters.slice(0, 3);
  }

  // LIMITADOR DE IMPACTO TONAL (V2)
  // Nunca ultrapassar -3 dB de corte total
  const MAX_TOTAL_CUT_DB = 3.0;
  
  let totalCutDb = 0;
  const filterGains = [];
  
  // Calcular corte total
  for (const filter of filters) {
    const gainMatch = filter.match(/g=(-?\d+\.?\d*)/);
    if (gainMatch) {
      const gain = parseFloat(gainMatch[1]);
      if (gain < 0) {
        totalCutDb += Math.abs(gain);
        filterGains.push(Math.abs(gain));
      } else {
        filterGains.push(0);
      }
    } else {
      filterGains.push(0);
    }
  }
  
  // Se ultrapassar limite, escalar cortes proporcionalmente
  if (totalCutDb > MAX_TOTAL_CUT_DB) {
    const scaleFactor = MAX_TOTAL_CUT_DB / totalCutDb;
    
    // Reescrever filtros com ganhos escalados
    const scaledFilters = [];
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      const originalGain = filterGains[i];
      
      if (originalGain > 0) {
        const scaledGain = originalGain * scaleFactor;
        const newFilter = filter.replace(/g=(-?\d+\.?\d*)/, `g=-${scaledGain.toFixed(2)}`);
        scaledFilters.push(newFilter);
      } else {
        scaledFilters.push(filter);
      }
    }
    
    filters = scaledFilters;
    totalCutDb = MAX_TOTAL_CUT_DB;
  }
  
  const filterString = filters.join(',');
  const impact = estimateTonalImpact(filters);
  
  return {
    filters: filterString,
    impact: impact
  };
}

// ============================================================
// ANÁLISE DE ESTABILIDADE DINÂMICA
// ============================================================

/**
 * Analisa a estabilidade dinâmica do áudio para detectar riscos de pumping,
 * mix instável ou subgrave dominante.
 * 
 * Este módulo NÃO altera o áudio, apenas retorna flags para auxílio na decisão.
 * 
 * @param {string} inputPath - Caminho do arquivo de entrada
 * @returns {Promise<Object>} - Objeto com flags e recomendação
 */
async function analyzeDynamicStability(inputPath) {
  return new Promise((resolve, reject) => {
    // Etapa 1: Analisar variações de loudness com ebur128
    const ebur128Args = [
      '-i', inputPath,
      '-af', 'ebur128=framelog=verbose',
      '-f', 'null',
      '-'
    ];

    execFile('ffmpeg', ebur128Args, { timeout: 120000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stderr) {
        reject(new Error(`Erro ao analisar estabilidade dinâmica: ${error.message}`));
        return;
      }

      try {
        // Parsear loudness momentâneo e short-term
        const momentaryValues = [];
        const shortTermValues = [];

        const lines = stderr.split('\n');
        for (const line of lines) {
          // Capturar valores momentâneos (M:)
          const momentaryMatch = line.match(/M:\s*(-?\d+\.\d+)/);
          if (momentaryMatch) {
            const val = parseFloat(momentaryMatch[1]);
            if (val > -70) { // Ignorar silêncio
              momentaryValues.push(val);
            }
          }

          // Capturar valores short-term (S:)
          const shortTermMatch = line.match(/S:\s*(-?\d+\.\d+)/);
          if (shortTermMatch) {
            const val = parseFloat(shortTermMatch[1]);
            if (val > -70) { // Ignorar silêncio
              shortTermValues.push(val);
            }
          }
        }

        // Calcular métricas
        let unstableDynamics = false;
        let pumpingRisk = false;

        if (shortTermValues.length > 10) {
          const maxShortTerm = Math.max(...shortTermValues);
          const minShortTerm = Math.min(...shortTermValues);
          const shortTermRange = maxShortTerm - minShortTerm;

          // Range de short-term > 8 LU indica instabilidade
          if (shortTermRange > 8) {
            unstableDynamics = true;
          }
        }

        if (momentaryValues.length > 10) {
          const maxMomentary = Math.max(...momentaryValues);
          const minMomentary = Math.min(...momentaryValues);
          const momentaryRange = maxMomentary - minMomentary;

          // Variação momentânea > 10 LU indica risco de pumping
          if (momentaryRange > 10) {
            pumpingRisk = true;
          }
        }

        // Etapa 2: Analisar energia de subgrave
        const subArgs = [
          '-i', inputPath,
          '-af', 'lowpass=f=120,astats=reset=1',
          '-f', 'null',
          '-'
        ];

        execFile('ffmpeg', subArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (subError, subStdout, subStderr) => {
          let subDominant = false;

          if (!subError || subStderr) {
            // Parsear RMS do sub
            const rmsMatch = subStderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
            if (rmsMatch) {
              const subRms = parseFloat(rmsMatch[1]);

              // Analisar energia total (sem filtro)
              const totalArgs = [
                '-i', inputPath,
                '-af', 'astats=reset=1',
                '-f', 'null',
                '-'
              ];

              execFile('ffmpeg', totalArgs, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }, (totalError, totalStdout, totalStderr) => {
                if (!totalError || totalStderr) {
                  const totalRmsMatch = totalStderr.match(/RMS level dB:\s*(-?\d+\.\d+)/);
                  if (totalRmsMatch) {
                    const totalRms = parseFloat(totalRmsMatch[1]);

                    // Se sub tem energia desproporcionalmente alta
                    // (diferença menor que 2 dB indica sub dominante)
                    if ((totalRms - subRms) < 2.0) {
                      subDominant = true;
                    }
                  }
                }

                // Determinar recomendação
                let recommendation = 'safe';
                if (pumpingRisk || subDominant) {
                  recommendation = 'conservative';
                } else if (unstableDynamics) {
                  recommendation = 'reduce_target';
                }

                resolve({
                  unstableDynamics,
                  pumpingRisk,
                  subDominant,
                  recommendation
                });
              });
            } else {
              // Não conseguiu parsear, retornar safe
              resolve({
                unstableDynamics,
                pumpingRisk,
                subDominant: false,
                recommendation: unstableDynamics ? 'reduce_target' : 'safe'
              });
            }
          } else {
            // Erro na análise de sub, retornar sem essa flag
            resolve({
              unstableDynamics,
              pumpingRisk,
              subDominant: false,
              recommendation: (pumpingRisk || unstableDynamics) ? 'conservative' : 'safe'
            });
          }
        });
      } catch (parseError) {
        reject(new Error(`Erro ao parsear análise dinâmica: ${parseError.message}`));
      }
    });
  });
}

/**
 * PASSO 1.9: Aplicar EQ defensivo + Pre-Limiter em arquivo temporário (pré-medição)
 * 
 * Essa função cria um arquivo temporário com EQ defensivo + Pre-Limiter (se necessário),
 * permitindo que o two-pass loudnorm meça e processe o mesmo áudio.
 * 
 * CRITICAL: O two-pass loudnorm DEVE medir o áudio após EQ+Limiter para evitar incompatibilidade.
 * 
 * @param {boolean} usePreLimiter - Se true, aplica pre-limiter leve (-3.0 dB) antes do loudnorm
 */
function applyDefensiveEQAndLimiterTemp(inputPath, defensiveEQFilters, preGainDb, usePreLimiter, inputSampleRate, mode, debug = false) {
  return new Promise((resolve, reject) => {
    if (!defensiveEQFilters && preGainDb === 0 && !usePreLimiter) {
      resolve(null); // Sem processamento, retornar null
      return;
    }

    const tempFile = `${inputPath}.eq_pregain_limiter_temp.wav`;
    
    // Definir threshold do pre-limiter por modo
    const MODE_LIMITER_THRESHOLDS = {
      'STREAMING': { linear: 0.708, db: -3.0 },  // Mais conservador
      'BALANCED': { linear: 0.794, db: -2.0 },   // Moderado
      'IMPACT': { linear: 0.891, db: -1.5 }      // Mais agressivo (evita esmagamento precoce)
    };
    
    const limiterProfile = MODE_LIMITER_THRESHOLDS[mode] || MODE_LIMITER_THRESHOLDS['BALANCED'];
    
    if (debug) {
      console.error('[DEBUG] [EQ+PRE-GAIN+LIMITER TEMP] Aplicando processamento em arquivo temporário...');
      console.error(`[DEBUG] [EQ+PRE-GAIN+LIMITER TEMP] Input: ${inputPath}`);
      console.error(`[DEBUG] [EQ+PRE-GAIN+LIMITER TEMP] Temp: ${tempFile}`);
      if (defensiveEQFilters) console.error(`[DEBUG] [EQ+PRE-GAIN+LIMITER TEMP] EQ Filters: ${defensiveEQFilters}`);
      if (preGainDb > 0) console.error(`[DEBUG] [EQ+PRE-GAIN+LIMITER TEMP] Pre-Gain: ${preGainDb.toFixed(2)} dB (volume filter)`);
      if (usePreLimiter) console.error(`[DEBUG] [EQ+PRE-GAIN+LIMITER TEMP] Pre-Limiter: alimiter=limit=${limiterProfile.linear.toFixed(3)}:level=false:asc=true (${limiterProfile.db.toFixed(1)} dBFS, mode=${mode})`);
    }
    
    // Log obrigatório de perfil do limiter
    if (usePreLimiter) {
      console.error(`[LIMITER MODE PROFILE] mode=${mode} threshold=${limiterProfile.db.toFixed(1)}dBFS linear=${limiterProfile.linear.toFixed(3)}`);
    }

    // Construir filter chain: EQ + Pre-Gain + Pre-Limiter (ordem crítica!)
    let filterChain = [];
    if (defensiveEQFilters) filterChain.push(defensiveEQFilters);
    if (preGainDb > 0) {
      filterChain.push(`volume=${preGainDb.toFixed(2)}dB`);
    }
    if (usePreLimiter) {
      // Pre-Limiter com threshold ajustado por modo
      filterChain.push(`alimiter=limit=${limiterProfile.linear.toFixed(3)}:level=false:asc=true`);
    }
    
    const finalFilter = filterChain.join(',');

    const args = [
      '-i', inputPath,
      '-af', finalFilter,
      '-y',
      tempFile
    ];

    // Preservar sample rate
    if (inputSampleRate) {
      args.splice(args.indexOf('-y'), 0, '-ar', inputSampleRate.toString());
    }

    const ffmpegProcess = execFile('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 });

    ffmpegProcess.on('close', (code) => {
      if (code === 0 && fs.existsSync(tempFile)) {
        if (debug) {
          console.error('[DEBUG] [EQ+PRE-GAIN+LIMITER TEMP] Arquivo temporário criado com sucesso');
        }
        resolve(tempFile);
      } else {
        reject(new Error(`Falha ao criar arquivo temporário com EQ+Pre-Gain+Limiter (exit code: ${code})`));
      }
    });

    ffmpegProcess.on('error', (err) => {
      reject(new Error(`Erro ao executar FFmpeg para EQ+Pre-Gain+Limiter temporário: ${err.message}`));
    });
  });
}

/**
 * PASSO 2: Render com two-pass loudnorm + alimiter
 * 
 * IMPORTANTE: inputPath agora pode ser arquivo temporário com EQ já aplicado.
 * Neste caso, defensiveEQFilters deve ser null para evitar dupla aplicação.
 */
function renderTwoPass(inputPath, outputPath, targetI, targetTP, targetLRA, measured, usedTP, strategy, inputSampleRate, preGainDb = 0, defensiveEQFilters = null, usePreLimiter = false, debug = false) {
  return new Promise((resolve, reject) => {
    // Converter ceiling para linear (alimiter)
    const linearLimit = Math.max(0.0625, Math.min(1, dbToLinear(usedTP)));

    // Construir filtro two-pass com parâmetros explícitos de estabilidade
    // USAR measured_LRA ao invés de forçar targetLRA (evita compressão indesejada)
    const loudnormFilter = [
      `loudnorm=I=${targetI}`,
      `TP=${usedTP}`,
      `LRA=${measured.input_lra}`,
      `measured_I=${measured.input_i}`,
      `measured_TP=${measured.input_tp}`,
      `measured_LRA=${measured.input_lra}`,
      `measured_thresh=${measured.input_thresh}`,
      `offset=${measured.target_offset}`,
      `linear=true`,
      `print_format=summary`
    ].join(':');
    
    // LOGS PASS 2 (parâmetros do render)
    if (debug) {
      console.error(`[DEBUG] [PASS 2] Target I: ${targetI.toFixed(2)} LUFS`);
      console.error(`[DEBUG] [PASS 2] Target TP: ${usedTP.toFixed(2)} dBTP`);
      console.error(`[DEBUG] [PASS 2] Target LRA: ${measured.input_lra.toFixed(2)} LU (using measured, not forced)`);
      console.error(`[DEBUG] [PASS 2] Using measured_I: ${measured.input_i.toFixed(2)} LUFS`);
      console.error(`[DEBUG] [PASS 2] Using measured_TP: ${measured.input_tp.toFixed(2)} dBTP`);
      console.error(`[DEBUG] [PASS 2] Using measured_LRA: ${measured.input_lra.toFixed(2)} LU`);
      console.error(`[DEBUG] [PASS 2] Using measured_thresh: ${measured.input_thresh.toFixed(2)} LUFS`);
      console.error(`[DEBUG] [PASS 2] Using offset: ${measured.target_offset.toFixed(2)} LU`);
    }

    // Ajuste conservador de limiter quando strategy CLEAN é solicitada.
    let alimiterFilter;
    if (strategy === 'CLEAN') {
      // Mais suave: maior attack/release para reduzir artefatos agressivos
      alimiterFilter = `alimiter=limit=${linearLimit.toFixed(6)}:attack=20:release=150:level=false`;
    } else {
      alimiterFilter = `alimiter=limit=${linearLimit.toFixed(6)}:attack=5:release=50:level=false`;
    }

    // Construir chain: [EQ defensivo] + pré-ganho (se necessário) + [pre-limiter] + loudnorm + limiter
    // Pipeline: INPUT → EQ defensivo → volume → pre-limiter → loudnorm → limiter final
    let audioFilter;
    
    const filterChain = [];
    
    // Adicionar EQ defensivo se presente (antes de loudnorm)
    // Nota: Se inputPath já é arquivo temporário com EQ, defensiveEQFilters será null (evita dupla aplicação)
    if (defensiveEQFilters) {
      filterChain.push(defensiveEQFilters);
      if (debug) {
        console.error(`[DEBUG] [FILTER CHAIN] EQ defensivo aplicado no render`);
      }
    }
    
    // Adicionar pre-gain se necessário (após EQ, antes de pre-limiter/loudnorm)
    if (preGainDb > 0) {
      const volumeFilter = `volume=${preGainDb.toFixed(1)}dB`;
      filterChain.push(volumeFilter);
    }
    
    // Adicionar pre-limiter se necessário (cria headroom para loudnorm)
    // Nota: Se inputPath já é arquivo temporário com pre-limiter, usePreLimiter será false (evita dupla aplicação)
    if (usePreLimiter) {
      // Pre-Limiter: -3.0 dBFS = 10^(-3.0/20) = 0.7079457843841379 (linear)
      // Threshold agressivo para criar headroom máximo para loudnorm
      filterChain.push('alimiter=limit=0.708:level=false:asc=true');
      if (debug) {
        console.error('[DEBUG] [FILTER CHAIN] Pre-Limiter aplicado no render (-3.0 dBFS = 0.708 linear, aggressive)');
      }
    }
    
    // Adicionar loudnorm e limiter final
    filterChain.push(loudnormFilter);
    filterChain.push(alimiterFilter);
    
    audioFilter = filterChain.join(',');

    const args = [
      '-i', inputPath,
      '-af', audioFilter,
      '-y',
      outputPath
    ];
    
    // Preservar sample rate do input (evita upsampling automático do loudnorm para 192k)
    if (inputSampleRate) {
      args.splice(args.indexOf('-y'), 0, '-ar', inputSampleRate.toString());
    }

    const startTime = Date.now();
    const ffmpegProcess = execFile('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 });

    let stderrData = '';

    ffmpegProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (code === 0) {
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          const sizeKB = (stats.size / 1024).toFixed(2);
          
          resolve({
            success: true,
            duration: parseFloat(duration),
            outputSize: sizeKB,
            stderr: stderrData
          });
        } else {
          reject(new Error('FFmpeg retornou código 0 mas arquivo de saída não foi criado'));
        }
      } else {
        reject(new Error(`FFmpeg falhou com código ${code}. Stderr:\n${stderrData}`));
      }
    });

    ffmpegProcess.on('error', (err) => {
      reject(new Error(`Erro ao executar FFmpeg: ${err.message}`));
    });
  });
}

// ============================================================
// PROTEÇÃO CONSERVADORA DE LOUDNESS
// ============================================================

/**
 * Avalia a capacidade da mix de ser empurrada para targets mais altos.
 * 
 * DETERMINÍSTICO: Usa apenas lógica condicional, sem IA ou heurísticas probabilísticas.
 * CONSERVADOR: Prioriza preservar qualidade sobre alcançar targets artificiais.
 * 
 * V1-SAFE: Ordem de validações garantida:
 * 1. Validação de métricas (null/undefined/NaN)
 * 2. Hard stops: unstableDynamics, delta<0, |delta|≤1, crest<6
 * 3. Base offset por crest (0.3/0.7/1.0)
 * 4. Sub dominante CAP (não return cedo)
 * 5. Cap final obrigatório (delta e 1.0)
 * 6. Fallback cap (0.7 se isFallback)
 * 
 * @param {Object} options - Parâmetros de análise
 * @param {number} options.crestFactor - Crest factor em dB (dinâmica)
 * @param {number} options.subRms - RMS da banda sub (<120Hz) em dB
 * @param {number} options.bodyRms - RMS total (body) em dB
 * @param {boolean} options.unstableDynamics - Flag de instabilidade dinâmica
 * @param {number} options.currentLufs - LUFS integrado atual
 * @param {number} options.targetLufs - Target LUFS desejado
 * @param {boolean} [options.isFallback=false] - Flag para fallback mode (sem spectral data)
 * @returns {Object} Avaliação de capacidade { canPush, pushStrength, reason, recommendedLufsOffset }
 */
function evaluateMixCapacity(options) {
  const { 
    crestFactor, 
    subRms, 
    bodyRms, 
    unstableDynamics, 
    currentLufs, 
    targetLufs,
    isFallback = false
  } = options;
  
  // 1. VALIDAÇÃO DE MÉTRICAS OBRIGATÓRIAS
  if (
    crestFactor == null || isNaN(crestFactor) ||
    subRms == null || isNaN(subRms) ||
    bodyRms == null || isNaN(bodyRms) ||
    unstableDynamics == null ||
    currentLufs == null || isNaN(currentLufs) ||
    targetLufs == null || isNaN(targetLufs)
  ) {
    return {
      canPush: false,
      pushStrength: 'none',
      reason: 'missing_metrics',
      recommendedLufsOffset: 0
    };
  }
  
  // 2. HARD STOPS (ordem importa)
  
  // 2.1: Dinâmica instável
  if (unstableDynamics === true) {
    return {
      canPush: false,
      pushStrength: 'none',
      reason: 'unstable_dynamics',
      recommendedLufsOffset: 0
    };
  }
  
  // 2.2: Calcular delta
  const delta = targetLufs - currentLufs;
  
  // 2.3: Delta negativo (current já acima do target)
  if (delta < 0) {
    return {
      canPush: false,
      pushStrength: 'none',
      reason: 'delta_negative_current_above_target',
      recommendedLufsOffset: 0
    };
  }
  
  // 2.4: Crest factor muito baixo
  if (crestFactor < 6.0) {
    return {
      canPush: false,
      pushStrength: 'none',
      reason: 'low_crest',
      recommendedLufsOffset: 0
    };
  }
  
  // 2.5: Detectar sub dominante (necessário antes do hard stop de delta)
  const subDominance = subRms - bodyRms;
  const isSubDominant = subDominance > -6.0; // Comparador estrito: -6.0 exato = não dominante
  
  // 2.6: Já próximo do target
  // Permitir offsets pequenos para sub dominante, MAS NÃO em fallback mode (mais conservador)
  if (Math.abs(delta) <= 1.0 && (!isSubDominant || isFallback)) {
    return {
      canPush: false,
      pushStrength: 'none',
      reason: 'already_close_to_target',
      recommendedLufsOffset: 0
    };
  }
  
  // 3. CALCULAR BASE OFFSET POR CREST (determinístico)
  let offsetBase = 0;
  let strength = 'none';
  let reason = '';
  
  if (crestFactor >= 12.0) {
    offsetBase = 1.0;
    strength = 'high';
    reason = `crest_high_${crestFactor.toFixed(1)}dB`;
  } else if (crestFactor >= 9.0) {
    offsetBase = 0.7;
    strength = 'medium';
    reason = `crest_medium_${crestFactor.toFixed(1)}dB`;
  } else { // crestFactor >= 6.0 (já passou pelo hard stop)
    offsetBase = 0.3;
    strength = 'low';
    reason = `crest_low_${crestFactor.toFixed(1)}dB`;
  }
  
  // 4. SUB DOMINANTE CAP (não return cedo - já calculado em step 2.5)
  if (isSubDominant) {
    // Sub dominando: limitar offset a 0.5 LU (conservador)
    offsetBase = Math.min(offsetBase, 0.5);
    reason += '_sub_dominant_cap';
  }
  
  // 5. CAP FINAL OBRIGATÓRIO
  let offset = offsetBase;
  
  // 5.1: Cap pelo delta disponível
  offset = Math.min(offset, delta);
  
  // 5.2: Clamp entre 0 e 1.0
  offset = Math.max(0, Math.min(offset, 1.0));
  
  // 6. FALLBACK CAP (se em fallback mode)
  if (isFallback) {
    offset = Math.min(offset, 0.7);
    reason += '_fallback_cap';
  }
  
  return {
    canPush: offset > 0,
    pushStrength: offset > 0 ? strength : 'none',
    reason: reason,
    recommendedLufsOffset: offset
  };
}

/**
 * Calcula target LUFS seguro baseado em filosofia conservadora.
 * O AutoMaster V1 prioriza naturalidade sobre alcançar o target.
 * 
 * Regras:
 * - delta <= 4 LU: usar target normalmente (safe zone)
 * - 4 < delta <= 6 LU: permitir, mas logar aviso (warning zone)
 * - delta > 6 LU: limitar a input + 4.5 LU (proteção conservadora)
 * 
 * @param {number} inputLufs - LUFS integrado do input
 * @param {number} targetLufs - Target LUFS desejado do gênero
 * @returns {number} Target LUFS ajustado para preservar naturalidade
 */
function computeSafeTarget(inputLufs, targetLufs, mode, crestFactor, subRatio) {
  const delta = targetLufs - inputLufs;
  
  // Verificar se mix tem capacidade para limites expandidos
  const mixHasCapacity = (crestFactor >= 6.0 && subRatio < 0.95);
  
  // Limites de delta por modo (EXPANDIDOS quando mix tem capacidade)
  let maxDelta;
  if (mixHasCapacity) {
    // Limites expandidos (mix com headroom e dinâmica saudável)
    const MODE_DELTA_LIMITS_EXPANDED = {
      'STREAMING': 4.5,  // Conservador
      'BALANCED': 6.0,   // Moderado
      'IMPACT': 8.5      // Agressivo (perceptivelmente mais alto)
    };
    maxDelta = MODE_DELTA_LIMITS_EXPANDED[mode] || MODE_DELTA_LIMITS_EXPANDED['BALANCED'];
    console.error(`[MODE CAPACITY LIMIT] mode=${mode} maxDelta=${maxDelta.toFixed(1)} LU (EXPANDED: crest=${crestFactor.toFixed(1)}dB subRatio=${(subRatio * 100).toFixed(1)}%)`);
  } else {
    // Limites padrão (mix sem capacidade)
    const MODE_DELTA_LIMITS_DEFAULT = {
      'STREAMING': 4.0,
      'BALANCED': 5.5,
      'IMPACT': 7.0
    };
    maxDelta = MODE_DELTA_LIMITS_DEFAULT[mode] || MODE_DELTA_LIMITS_DEFAULT['BALANCED'];
    console.error(`[MODE CAPACITY LIMIT] mode=${mode} maxDelta=${maxDelta.toFixed(1)} LU (DEFAULT: crest=${crestFactor.toFixed(1)}dB subRatio=${(subRatio * 100).toFixed(1)}%)`);
  }
  
  // Log de validação do safe window para IMPACT
  if (mode === 'IMPACT') {
    if (mixHasCapacity) {
      console.error(`[IMPACT SAFE WINDOW PASSED] crest=${crestFactor.toFixed(1)}dB>=6.0 subRatio=${(subRatio * 100).toFixed(1)}%<95% → maxDelta=${maxDelta.toFixed(1)} LU`);
    } else {
      console.error(`[IMPACT SAFE WINDOW FAILED] crest=${crestFactor.toFixed(1)}dB<6.0 OR subRatio=${(subRatio * 100).toFixed(1)}%>=95% → maxDelta=${maxDelta.toFixed(1)} LU (limited)`);
    }
  }
  
  // Safe zone: delta dentro do limite do modo
  if (delta <= maxDelta) {
    return targetLufs;
  }
  
  // Protection zone: delta excede limite do modo
  // Limitar ao máximo permitido, mas preservar diferença entre modos
  return inputLufs + maxDelta;
}

/**
 * Calcula crest factor aproximado em dB.
 * Crest factor = diferença entre true peak e loudness (estimativa).
 */
function estimateCrestFactor(inputLufs, inputTruePeak) {
  // Crest factor aproximado: diferença entre peak e loudness
  // Quanto maior, mais dinâmico o áudio
  return inputTruePeak - inputLufs;
}

/**
 * Calcula pré-ganho linear para evitar degrau de ganho no início do áudio.
 * 
 * Quando o delta de loudness é muito grande, o loudnorm pode causar um "salto"
 * de volume no primeiro segundo. Aplicar um pré-ganho suave resolve isso.
 * 
 * @param {number} inputLufs - LUFS do input (medido)
 * @param {number} targetLufs - Target LUFS desejado
 * @returns {number} - Pré-ganho em dB (sempre >= 0, nunca reduz volume)
 */
/**
 * GAIN STAGING STRATEGY V2
 * 
 * Transfere ganho principal para pré-ganho controlado, deixando loudnorm fazer apenas ajuste fino.
 * Isso evita saturação do loudnorm e erro de LUFS em deltas grandes.
 * 
 * Regras:
 * - Se delta > 1.5 LU: preGain = delta * 0.7 (máximo +3 dB)
 * - CRÍTICO: Pre-gain pode causar TP temporário > target (limiter fix aplica no final)
 * - Loudnorm recebe measured_I ajustado (input_i + preGain), target original
 * - Margin de segurança: +2.0 dB (True Peak Fix corrige afterwards)
 */
function computePreGainDb(inputLufs, targetLufs, measuredTp, targetTp) {
  const delta = targetLufs - inputLufs;
  
  // Se delta <= 1.5 LU, loudnorm trabalha bem sozinho
  if (delta <= 1.5) {
    return 0;
  }
  
  // Se delta > 1.5 LU, aplicar pré-ganho controlado
  // Fórmula: 70% do delta (deixa 30% para loudnorm fazer ajuste fino)
  // Limite máximo: +3.0 dB (evita oversaturation)
  let preGain = Math.min(delta * 0.7, 3.0);
  
  // Relaxar limite de True Peak temporariamente (+2.0 dB headroom)
  // O True Peak Fix vai corrigir no final
  const tpHeadroomRelaxed = targetTp - measuredTp + 2.0;
  if (tpHeadroomRelaxed < preGain) {
    preGain = Math.max(0, tpHeadroomRelaxed);
  }
  
  return preGain;
}

/**
 * Função principal: Two-pass + fallback determinístico via fix-true-peak
 */
async function runTwoPassLoudnorm(options) {
  const { inputPath, outputPath, targetI, targetTP, targetLRA = 7, mode, strategy } = options;
  const debug = process.env.DEBUG_PIPELINE === 'true';

  if (debug) {
    console.error('[DEBUG] TWO-PASS LOUDNORM + VALIDACAO DETERMINISTCA');
  }

  // ============================================================
  // ETAPA 1: RENDER PRINCIPAL
  // ============================================================
  
  if (debug) {
    console.error(`[DEBUG] RENDER PRINCIPAL - Target: ${targetI} LUFS / ${targetTP.toFixed(2)} dBTP`);
  }

  // Passo 0: Detectar sample rate do input para preservação
  if (debug) console.error('[DEBUG] [0/5] Detectando sample rate do input...');
  const inputSampleRate = await detectInputSampleRate(inputPath);
  if (debug) console.error(`[DEBUG] Input SR: ${inputSampleRate} Hz`);

  // Passo 0.5: Detectar início efetivo da música (ignora introduções silenciosas)
  if (debug) console.error('[DEBUG] [0.5/5] Detectando início efetivo da música...');
  const effectiveStartTime = await detectEffectiveStartTime(inputPath);
  if (effectiveStartTime > 0) {
    console.error(`[AutoMaster] Intro silenciosa detectada: ignorando primeiros ${effectiveStartTime.toFixed(2)}s na medição`);
    if (debug) {
      console.error(`[DEBUG] Effective start time: ${effectiveStartTime.toFixed(2)}s`);
    }
  } else if (debug) {
    console.error('[DEBUG] Effective start time: 0s (nenhuma intro silenciosa detectada)');
  }

  // Passo 1: Análise de loudness INICIAL (para decisão de EQ)
  // Esta medição é preliminar e será refeita após aplicar EQ (se necessário)
  if (debug) {
    console.error('[DEBUG] [1/5] Analisando loudness (análise preliminar para EQ decision)...');
    console.error('[DEBUG] Loudness measurement using highpass=40Hz (técnico, não altera render)');
    if (effectiveStartTime > 0) {
      console.error(`[DEBUG] Measurement starts at ${effectiveStartTime.toFixed(2)}s (ignora intro silenciosa)`);
    }
  }
  const preliminaryMeasured = await analyzeLoudness(inputPath, targetI, targetTP, targetLRA, effectiveStartTime);
  if (debug) {
    console.error(`[DEBUG] [PRELIMINARY MEASUREMENT] (para análise de EQ):`);
    console.error(`[DEBUG]   measured_I: ${preliminaryMeasured.input_i.toFixed(2)} LUFS`);
    console.error(`[DEBUG]   measured_TP: ${preliminaryMeasured.input_tp.toFixed(2)} dBTP`);
    console.error(`[DEBUG]   measured_LRA: ${preliminaryMeasured.input_lra.toFixed(2)} LU`);
  }

  // Passo 1.3: Análise de estabilidade dinâmica
  if (debug) console.error('[DEBUG] [1.3/5] Analisando estabilidade dinâmica...');
  const stability = await analyzeDynamicStability(inputPath);
  
  if (stability.unstableDynamics) {
    console.error('[AutoMaster] Dynamic instability detected');
  }
  if (stability.pumpingRisk) {
    console.error('[AutoMaster] Pumping risk detected — conservative mode');
  }
  if (stability.subDominant) {
    console.error('[AutoMaster] Sub energy dominant — conservative gain applied');
  }
  
  if (debug) {
    console.error(`[DEBUG] Stability: unstable=${stability.unstableDynamics}, pumping=${stability.pumpingRisk}, sub=${stability.subDominant}`);
    console.error(`[DEBUG] Recommendation: ${stability.recommendation}`);
  }

  // Passo 1.5A: Definir Base Target por Modo (GARANTIR DIFERENCIAÇÃO)
  // Targets fixos independentes do gênero para garantir diferenciação clara
  const MODE_BASE_TARGETS = {
    'STREAMING': -14.0,
    'BALANCED': -11.0,
    'IMPACT': -7.5
  };
  
  // Determinar modo atual (prioritiza mode, fallback para strategy, depois padrão BALANCED)
  const currentMode = (mode && ['STREAMING', 'BALANCED', 'IMPACT'].includes(mode)) 
    ? mode 
    : (strategy && ['STREAMING', 'BALANCED', 'IMPACT'].includes(strategy))
      ? strategy
      : 'BALANCED';
  
  const modeBaseTarget = MODE_BASE_TARGETS[currentMode];
  
  console.error(`[MODE] mode=${currentMode} base=${modeBaseTarget.toFixed(1)}`);
  if (debug) {
    console.error(`[DEBUG] [MODE TARGET] Using fixed base target for ${currentMode} mode`);
    console.error(`[DEBUG] [MODE TARGET] Ignoring genre-specific target (${targetI.toFixed(1)} LUFS)`);
  }
  
  // Usar modeBaseTarget como originalTarget
  const originalTarget = modeBaseTarget;
  let mixCapacity = null;
  
  // Passo 1.5B: Avaliação de Capacidade da Mix (LIMITADO)
  // Decisão inteligente: o quanto podemos empurrar o loudness sem degradar
  
  // Verificar se spectral data está disponível (quando analyzeForMaster implementado)
  if (stability.spectral && stability.spectral.bands) {
    const { sub, body } = stability.spectral.bands;
    const { crest } = stability.spectral;
    
    mixCapacity = evaluateMixCapacity({
      crestFactor: crest || estimateCrestFactor(measured.input_i, measured.input_tp),
      subRms: sub,
      bodyRms: body,
      unstableDynamics: stability.unstableDynamics,
      currentLufs: measured.input_i,
      targetLufs: originalTarget,
      isFallback: false
    });
    
    if (debug && mixCapacity) {
      console.error(`[DEBUG] Mix capacity evaluation (spectral data):`);
      console.error(`[DEBUG]   Can push: ${mixCapacity.canPush}`);
      console.error(`[DEBUG]   Strength: ${mixCapacity.pushStrength}`);
      console.error(`[DEBUG]   Reason: ${mixCapacity.reason}`);
      console.error(`[DEBUG]   Recommended offset: ${mixCapacity.recommendedLufsOffset > 0 ? '+' : ''}${mixCapacity.recommendedLufsOffset.toFixed(2)} LU`);
    }
  } else {
    // Fallback: usar apenas crest factor estimado (sem spectral data)
    const estimatedCrest = estimateCrestFactor(preliminaryMeasured.input_i, preliminaryMeasured.input_tp);
    
    mixCapacity = evaluateMixCapacity({
      crestFactor: estimatedCrest,
      subRms: -20, // Valor neutro (assumir sub não dominante)
      bodyRms: -14, // Valor neutro
      unstableDynamics: stability.unstableDynamics,
      currentLufs: preliminaryMeasured.input_i,
      targetLufs: originalTarget,
      isFallback: true  // IMPORTANTE: ativa cap de 0.7 LU
    });
    
    if (debug && mixCapacity) {
      console.error(`[DEBUG] Mix capacity evaluation (fallback - sem spectral data):`);
      console.error(`[DEBUG]   Using estimated crest: ${estimatedCrest.toFixed(1)}dB`);
      console.error(`[DEBUG]   Fallback cap: 0.7 LU max`);
      console.error(`[DEBUG]   Can push: ${mixCapacity.canPush}`);
      console.error(`[DEBUG]   Reason: ${mixCapacity.reason}`);
      console.error(`[DEBUG]   Recommended offset: ${mixCapacity.recommendedLufsOffset > 0 ? '+' : ''}${mixCapacity.recommendedLufsOffset.toFixed(2)} LU`);
    }
  }
  
  // Aplicar offset de capacidade ao target original
  let targetWithCapacity = originalTarget;
  if (mixCapacity && mixCapacity.canPush && mixCapacity.recommendedLufsOffset > 0) {
    targetWithCapacity = originalTarget + mixCapacity.recommendedLufsOffset;
    
    if (debug) {
      console.error(`[DEBUG] Target ajustado por capacidade: ${originalTarget.toFixed(2)} + ${mixCapacity.recommendedLufsOffset.toFixed(2)} = ${targetWithCapacity.toFixed(2)} LUFS`);
    }
  }

  // Passo 1.2B: Classificação de Integridade da Mix (PRÉ-MASTERIZAÇÃO)
  // EXECUTAR ANTES de computeSafeTarget para usar valores reais de crest/subRatio
  // Detectar problemas estruturais que exigem target mais conservador:
  // - Subgrave excessivo (> 45% da energia)
  // - Crest factor baixo (< 6 dB = já comprimida)
  // - RMS variance alta (dinâmica inconsistente)
  if (debug) console.error('[DEBUG] [1.2B/5] Classificando integridade da mix...');
  
  const mixIntegrity = await classifyMixIntegrity(inputPath);
  
  console.error(`[AutoMaster] Mix integrity: ${mixIntegrity.integrity}`);
  console.error(`[AutoMaster] Risk score: ${mixIntegrity.riskScore}/3 (subRatio=${(mixIntegrity.subRatio * 100).toFixed(1)}%, crest=${mixIntegrity.crestFactor.toFixed(1)}dB, variance=${mixIntegrity.rmsVarianceHigh})`);

  // Passo 1.2C: Classificação de Capacidade de Loudness
  // Informar ao usuário sobre comportamento esperado do modo IMPACT
  const crest = mixIntegrity.crestFactor;
  const subRatio = mixIntegrity.subRatio * 100; // Converter para porcentagem
  const integrityScore = -mixIntegrity.riskScore; // Converter riskScore para integrityScore
  
  let mixClass;
  if (crest >= 7 && subRatio < 90 && integrityScore >= -1) {
    mixClass = 'SAFE_FOR_IMPACT';
  } else if (crest >= 5 && subRatio < 96) {
    mixClass = 'LIMITED_FOR_IMPACT';
  } else {
    mixClass = 'NOT_RECOMMENDED';
  }
  
  console.error(`[MIX CLASS] ${mixClass}`);

  // Passo 1.5B: Proteção Conservadora de Loudness (POR MODO)
  // AutoMaster V1 prioriza naturalidade sobre alcançar o target
  // USAR valores reais de crest e subRatio de mixIntegrity
  const deltaWanted = targetWithCapacity - preliminaryMeasured.input_i;
  
  let adjustedTarget = computeSafeTarget(preliminaryMeasured.input_i, targetWithCapacity, currentMode, mixIntegrity.crestFactor, mixIntegrity.subRatio);
  const deltaApplied = adjustedTarget - preliminaryMeasured.input_i;
  
  // Log de capacidade aplicada
  let capacityReason = 'OK';
  if (deltaApplied < deltaWanted) {
    capacityReason = 'DELTA_CLAMP';
  }
  console.error(`[CAPACITY] measuredI=${preliminaryMeasured.input_i.toFixed(1)} deltaWanted=${deltaWanted.toFixed(2)} deltaApplied=${deltaApplied.toFixed(2)} reason=${capacityReason}`);
  
  // Aplicar recomendação de estabilidade dinâmica (POR MODO)
  const MODE_STABILITY_LIMITS = {
    'conservative': {
      'STREAMING': 3.0,
      'BALANCED': 4.0,
      'IMPACT': 5.5
    },
    'reduce_target': {
      'STREAMING': 3.5,
      'BALANCED': 4.5,
      'IMPACT': 6.0
    }
  };
  
  if (stability.recommendation === 'conservative') {
    const limit = MODE_STABILITY_LIMITS.conservative[currentMode] || MODE_STABILITY_LIMITS.conservative['BALANCED'];
    const conservativeTarget = preliminaryMeasured.input_i + limit;
    if (adjustedTarget < conservativeTarget) {
      adjustedTarget = conservativeTarget;
      if (debug) {
        console.error(`[DEBUG] Conservative limit applied (${currentMode}): target adjusted to ${adjustedTarget.toFixed(2)} LUFS (max +${limit.toFixed(1)} LU)`);
      }
    }
  } else if (stability.recommendation === 'reduce_target') {
    const limit = MODE_STABILITY_LIMITS.reduce_target[currentMode] || MODE_STABILITY_LIMITS.reduce_target['BALANCED'];
    const reducedTarget = preliminaryMeasured.input_i + limit;
    if (adjustedTarget < reducedTarget) {
      adjustedTarget = reducedTarget;
      if (debug) {
        console.error(`[DEBUG] Reduced target applied (${currentMode}): target adjusted to ${adjustedTarget.toFixed(2)} LUFS (max +${limit.toFixed(1)} LU)`);
      }
    }
  }
  
  // Calcular ajuste de target baseado na integridade (REDUÇÃO RELATIVA)
  // Valores reduzidos para preservar diferenciação entre modos
  let integrityAdjustment = 0;
  if (mixIntegrity.integrity === 'RISKY') {
    integrityAdjustment = -1.0;  // Redução moderada
  } else if (mixIntegrity.integrity === 'POOR') {
    integrityAdjustment = -2.0;  // Redução conservadora
  }
  
  console.error(`[INTEGRITY] score=${mixIntegrity.riskScore} reduction=${integrityAdjustment.toFixed(1)} integrity=${mixIntegrity.integrity}`);
  
  // Definir target final considerando integridade (decisão única, não retroativa)
  const finalTargetI = adjustedTarget + integrityAdjustment;
  
  // Log de limitação de IMPACT por capacidade da mix (ao invés de colapso silencioso)
  if (currentMode === 'IMPACT') {
    const impactExpectedMinimum = MODE_BASE_TARGETS['BALANCED'] + 1.5;
    if (finalTargetI > impactExpectedMinimum) {
      const deltaFromBalanced = finalTargetI - MODE_BASE_TARGETS['BALANCED'];
      console.error(`[IMPACT LIMITED BY MIX CAPACITY] finalTarget=${finalTargetI.toFixed(1)} LUFS (+${deltaFromBalanced.toFixed(1)} LU from BALANCED base)`);
    }
  }
  
  // Logar decisão final (com modo, base, ajuste e resultado)
  console.error(`[FINAL TARGET] finalTargetI=${finalTargetI.toFixed(1)} mode=${currentMode} modeBase=${modeBaseTarget.toFixed(1)} afterSafety=${adjustedTarget.toFixed(1)} integrity=${integrityAdjustment.toFixed(1)}`);
  
  if (debug) {
    console.error(`[DEBUG] [TARGET CALCULATION]`);
    console.error(`[DEBUG]   Mode: ${currentMode}`);
    console.error(`[DEBUG]   Mode base: ${modeBaseTarget.toFixed(2)} LUFS`);
    console.error(`[DEBUG]   After capacity+safety: ${adjustedTarget.toFixed(2)} LUFS`);
    console.error(`[DEBUG]   Integrity adjustment: ${integrityAdjustment.toFixed(2)} LU`);
    console.error(`[DEBUG]   Final target: ${finalTargetI.toFixed(2)} LUFS`);
    
    if (integrityAdjustment < 0) {
      console.error(`[DEBUG] [MIX INTEGRITY] Target reduzido para proteger qualidade`);
    } else {
      console.error(`[DEBUG] [MIX INTEGRITY] Integridade OK, sem redução`);
    }
  }
  
  // Logar avisos baseados no delta (após decisão final)
  const finalDelta = finalTargetI - preliminaryMeasured.input_i;
  if (finalDelta > 6) {
    // Protection zone: target limitado para preservar dinâmica
    console.error(`[AutoMaster] Warning: Large loudness delta (${finalDelta.toFixed(1)} LU)`);
    console.error(`[AutoMaster] Conservative limit applied to preserve quality`);
    
    if (debug) {
      console.error(`[DEBUG] Protection zone: delta ${finalDelta.toFixed(1)} LU > 6 LU`);
    }
  } else if (finalDelta > 4) {
    // Warning zone: permitido, mas logar aviso
    console.error(`[AutoMaster] Warning: Large loudness delta (${finalDelta.toFixed(1)} LU)`);
    
    if (debug) {
      console.error(`[DEBUG] Warning zone: delta ${finalDelta.toFixed(1)} LU in range 4-6 LU`);
    }
  } else if (debug) {
    // Safe zone: delta <= 4 LU
    console.error(`[DEBUG] Safe zone: delta ${finalDelta.toFixed(1)} LU <= 4 LU`);
  }

  // Passo 1.3: Análise de Risco Espectral (EQ Defensivo V4 - Estatisticamente Robusto)
  // Detectar subgrave excessivo (pumping) e harshness extremo (overshoot)
  // V4: Janelas de 2s, estatísticas robustas (median+mean+variance), validação >= 10 janelas
  if (debug) console.error('[DEBUG] [1.3/5] Analisando riscos espectrais (EQ defensivo V4)...');
  
  const spectralRisk = await analyzeSpectralRisk(inputPath, preliminaryMeasured.input_i);
  
  // Verificar se análise foi bypassada por silêncio
  if (spectralRisk.bypassed) {
    if (debug) {
      console.error(`[DEBUG] [EQ ANALYSIS] Bypassado: ${spectralRisk.bypassReason}`);
      console.error(`[DEBUG] [EQ ANALYSIS] Input loudness: N/A (< -40 LUFS = silêncio)`);
    }
  } else {
    if (debug) {
      const stats = spectralRisk.stats || {};
      const windows = stats.windows || { valid: 0, total: 0 };
      const rms = stats.rms || { sub: 0, body: 0, presence: 0 };
      const sub = stats.sub || { median: 0, mean: 0, variance: 0, riskRatio: 0 };
      const presence = stats.presence || { median: 0, mean: 0, variance: 0, riskRatio: 0 };
      
      console.error(`[DEBUG] [EQ ANALYSIS] Janelas analisadas: ${windows.valid}/${windows.total} (mínimo: 10)`);
      console.error(`[DEBUG] [EQ ANALYSIS] Sub RMS médio: ${rms.sub.toFixed(2)} dB`);
      console.error(`[DEBUG] [EQ ANALYSIS] Body RMS médio: ${rms.body.toFixed(2)} dB`);
      console.error(`[DEBUG] [EQ ANALYSIS] Presence RMS médio: ${rms.presence.toFixed(2)} dB`);
      
      // MÉTRICAS V4 - ESTATISTICAMENTE ROBUSTAS
      console.error(`[DEBUG] [EQ ANALYSIS] Sub median delta: ${sub.median.toFixed(2)} dB (critério: > -5 dB)`);
      console.error(`[DEBUG] [EQ ANALYSIS] Sub mean delta: ${sub.mean.toFixed(2)} dB`);
      console.error(`[DEBUG] [EQ ANALYSIS] Sub variance: ${sub.variance.toFixed(2)} dB² (critério: < 60)`);
      console.error(`[DEBUG] [EQ ANALYSIS] Sub risk ratio: ${(sub.riskRatio * 100).toFixed(1)}% (mínimo: 25%)`);
      
      console.error(`[DEBUG] [EQ ANALYSIS] Presence median delta: ${presence.median.toFixed(2)} dB (critério: > -6 dB)`);
      console.error(`[DEBUG] [EQ ANALYSIS] Presence mean delta: ${presence.mean.toFixed(2)} dB`);
      console.error(`[DEBUG] [EQ ANALYSIS] Presence variance: ${presence.variance.toFixed(2)} dB² (critério: < 60)`);
      console.error(`[DEBUG] [EQ ANALYSIS] Presence risk ratio: ${(presence.riskRatio * 100).toFixed(1)}% (mínimo: 25%)`);
      
      console.error(`[DEBUG] [EQ ANALYSIS] Sub dominant: ${spectralRisk.subDominant}`);
      console.error(`[DEBUG] [EQ ANALYSIS] Harsh: ${spectralRisk.harsh}`);
      
      // CONFIDENCE SCORE V4
      if (spectralRisk.confidence) {
        console.error(`[DEBUG] [EQ CONFIDENCE] Spectral stability: ${spectralRisk.confidence}`);
      }
    }
  }
  
  // Construir filtros EQ defensivo (se necessário)
  const defensiveEQResult = buildDefensiveEQFilters(spectralRisk);
  
  let defensiveEQFilters = null;
  let eqImpact = null;
  
  if (defensiveEQResult) {
    defensiveEQFilters = defensiveEQResult.filters;
    eqImpact = defensiveEQResult.impact;
    
    console.error(`[AutoMaster] Defensive EQ ativo: subDominant=${spectralRisk.subDominant} harsh=${spectralRisk.harsh}`);
    
    if (debug) {
      // LOG CONSOLIDADO V4 - DECISÃO DE EQ
      const stats = spectralRisk.stats || {};
      const sub = stats.sub || { median: 0, mean: 0, variance: 0, riskRatio: 0 };
      const presence = stats.presence || { median: 0, mean: 0, variance: 0, riskRatio: 0 };
      const windows = stats.windows || { valid: 0, total: 0 };
      
      console.error(`[DEBUG] ======================================`);
      console.error(`[DEBUG] [EQ DECISION] EQ APLICADO`);
      console.error(`[DEBUG] [EQ DECISION] Confidence: ${spectralRisk.confidence}`);
      console.error(`[DEBUG] [EQ DECISION] Windows: ${windows.valid}/${windows.total}`);
      console.error(`[DEBUG] [EQ DECISION] Sub: median=${sub.median.toFixed(2)}dB mean=${sub.mean.toFixed(2)}dB variance=${sub.variance.toFixed(2)} risk=${(sub.riskRatio * 100).toFixed(1)}%`);
      console.error(`[DEBUG] [EQ DECISION] Presence: median=${presence.median.toFixed(2)}dB mean=${presence.mean.toFixed(2)}dB variance=${presence.variance.toFixed(2)} risk=${(presence.riskRatio * 100).toFixed(1)}%`);
      console.error(`[DEBUG] [EQ DECISION] Filters: ${defensiveEQFilters}`);
      console.error(`[DEBUG] [EQ DECISION] Impact: ${eqImpact.level.toUpperCase()} (${eqImpact.totalCutDb.toFixed(2)}dB total cut)`);
      console.error(`[DEBUG] ======================================`);
    }
  } else {
    if (debug) {
      // LOG CONSOLIDADO V4 - BYPASS
      const stats = spectralRisk.stats || {};
      const sub = stats.sub || { median: 0, mean: 0, variance: 0, riskRatio: 0 };
      const presence = stats.presence || { median: 0, mean: 0, variance: 0, riskRatio: 0 };
      const windows = stats.windows || { valid: 0, total: 0 };
      
      console.error(`[DEBUG] ======================================`);
      console.error(`[DEBUG] [EQ DECISION] EQ BYPASSADO`);
      console.error(`[DEBUG] [EQ DECISION] Confidence: ${spectralRisk.confidence}`);
      console.error(`[DEBUG] [EQ DECISION] Windows: ${windows.valid}/${windows.total}`);
      console.error(`[DEBUG] [EQ DECISION] Sub: median=${sub.median.toFixed(2)}dB mean=${sub.mean.toFixed(2)}dB variance=${sub.variance.toFixed(2)} risk=${(sub.riskRatio * 100).toFixed(1)}%`);
      console.error(`[DEBUG] [EQ DECISION] Presence: median=${presence.median.toFixed(2)}dB mean=${presence.mean.toFixed(2)}dB variance=${presence.variance.toFixed(2)} risk=${(presence.riskRatio * 100).toFixed(1)}%`);
      
      // Razão do bypass
      if (spectralRisk.confidence === 'LOW') {
        const maxRiskRatio = Math.max(sub.riskRatio, presence.riskRatio);
        if (maxRiskRatio > 0.6) {
          console.error(`[DEBUG] [EQ DECISION] Reason: Confidence LOW mas risk ratio insuficiente (${(maxRiskRatio * 100).toFixed(1)}% <= 60%)`);
        } else {
          console.error(`[DEBUG] [EQ DECISION] Reason: Confidence LOW (dados instáveis ou insuficientes)`);
        }
      } else {
        console.error(`[DEBUG] [EQ DECISION] Reason: Sem risco detectado (sub=${spectralRisk.subDominant} harsh=${spectralRisk.harsh})`);
      }
      console.error(`[DEBUG] ======================================`);
    }
  }

  // Passo 1.5: CRITICAL - Aplicar EQ + Pre-Gain + Pre-Limiter em arquivo temporário (se necessário)
  // Isso garante que Pass 1 e Pass 2 do loudnorm trabalhem com o MESMO áudio
  
  // PRÉ-LIMITER: Decidir se é necessário baseado em True Peak preliminar
  // Ativar se: measured_TP > target_TP + 0.03 (margem conservadora)
  const needsPreLimiter = preliminaryMeasured.input_tp > (targetTP + 0.03);
  
  // PRÉ-GAIN: Calcular ANTES do temp file para aplicar JUNTO com pre-limiter
  // Estratégia: Pre-gain aumenta volume, pre-limiter controla picos, loudnorm faz ajuste fino
  const deltaForPreGain = finalTargetI - preliminaryMeasured.input_i;
  let preGainDb = 0;
  
  if (deltaForPreGain > 1.5) {
    // Transferir 70% do delta para pre-gain (loudnorm faz 30% restante)
    preGainDb = Math.min(deltaForPreGain * 0.7, 3.0);
    
    // Se pre-limiter está ativo, pode ser mais agressivo (pre-limiter protege)
    if (needsPreLimiter) {
      preGainDb = Math.min(deltaForPreGain * 0.7, 4.0);  // Limite aumentado para 4 dB
    }
    
    console.error('[PRE-GAIN] Applied: +' + preGainDb.toFixed(2) + ' dB');
    console.error('[PRE-GAIN] Delta LUFS: ' + deltaForPreGain.toFixed(2) + ' LU');
    console.error('[PRE-GAIN] TP safe: ' + (needsPreLimiter ? 'true (pre-limiter active)' : 'false (limited by TP headroom)'));
  } else if (debug) {
    console.error('[DEBUG] [PRE-GAIN] Not needed (delta <= 1.5 LU)');
  }
  
  if (needsPreLimiter) {
    console.error('[PRE-LIMITER] Activated: TRUE');
    console.error(`[PRE-LIMITER] Reason: Input TP ${preliminaryMeasured.input_tp.toFixed(2)} dBTP > threshold ${(targetTP + 0.03).toFixed(2)} dBTP`);
  } else if (debug) {
    console.error('[DEBUG] [PRE-LIMITER] Not needed (TP within safe range)');
  }
  
  eqTempFile = null;  // Reset
  let audioToMeasure = inputPath;  // Por padrão, medir o input original
  let audioToRender = inputPath;   // Por padrão, renderizar o input original
  let renderWithEQ = defensiveEQFilters; // Por padrão, aplicar EQ no render
  let renderWithPreGain = preGainDb; // Por padrão, aplicar pre-gain no render
  let renderWithPreLimiter = needsPreLimiter; // Aplicar pre-limiter no render se necessário
  
  if (defensiveEQFilters || needsPreLimiter || preGainDb > 0) {
    if (debug) {
      console.error('[DEBUG] [1.5/5] Aplicando EQ + Pre-Gain + Pre-Limiter em arquivo temporário...');
    }
    console.error('[PIPELINE] Applying defensive EQ + Pre-Gain + Pre-Limiter to temp file (for consistent measurement)');
    
    eqTempFile = await applyDefensiveEQAndLimiterTemp(inputPath, defensiveEQFilters, preGainDb, needsPreLimiter, inputSampleRate, currentMode, debug);
    
    if (eqTempFile) {
      audioToMeasure = eqTempFile;  // Medir COM EQ+Pre-Gain+Limiter
      audioToRender = eqTempFile;   // Renderizar COM EQ+Pre-Gain+Limiter
      renderWithEQ = null;          // NÃO aplicar EQ novamente no render
      renderWithPreGain = 0;        // NÃO aplicar pre-gain novamente no render
      renderWithPreLimiter = false; // NÃO aplicar pre-limiter novamente no render
      
      if (debug) {
        console.error(`[DEBUG] [EQ+PRE-GAIN+LIMITER TEMP] Medição e render usarão arquivo temporário: ${eqTempFile}`);
      }
    } else {
      console.error('[WARNING] Falha ao criar arquivo temporário com processamento, continuando sem processamento');
      renderWithEQ = null; // Bypassar EQ se falhou
      renderWithPreGain = 0; // Bypassar pre-gain se falhou
      renderWithPreLimiter = false; // Bypassar pre-limiter se falhou
    }
  } else if (debug) {
    console.error('[DEBUG] [1.5/5] EQ, Pre-Gain e Pre-Limiter bypassados, medição e render usarão input original');
  }

  // Passo 1.8: MEDIÇÃO FINAL (após EQ+Pre-Gain+Pre-Limiter, se aplicado)
  // Esta é a medição REAL que será usada pelo two-pass loudnorm
  if (debug) {
    console.error('[DEBUG] [1.8/5] Medindo áudio final (após EQ+Pre-Gain+Pre-Limiter)...');
    console.error(`[DEBUG] [MEASUREMENT] Arquivo a medir: ${audioToMeasure}`);
  }
  console.error('[PIPELINE] Measuring audio after EQ+Pre-Gain+Pre-Limiter (if applied)');
  
  const measured = await analyzeLoudness(audioToMeasure, targetI, targetTP, targetLRA, effectiveStartTime);
  if (debug) {
    console.error(`[DEBUG] [PASS 1 MEASUREMENT] (pós-EQ, valores finais):`);
    console.error(`[DEBUG]   measured_I: ${measured.input_i.toFixed(2)} LUFS`);
    console.error(`[DEBUG]   measured_TP: ${measured.input_tp.toFixed(2)} dBTP`);
    console.error(`[DEBUG]   measured_LRA: ${measured.input_lra.toFixed(2)} LU`);
    console.error(`[DEBUG]   measured_thresh: ${measured.input_thresh.toFixed(2)} LUFS`);
    console.error(`[DEBUG]   target_offset: ${measured.target_offset.toFixed(2)} LU`);
  }

  // Passo 1.9: Preparar parâmetros para loudnorm
  // NOTA: Pre-gain já foi aplicado no temp file (se necessário), então:
  // - measured já reflete o áudio APÓS EQ+Pre-Gain+Pre-Limiter
  // - loudnorm faz ajuste fino do delta restante (< 2 LU)
  let measuredForLoudnorm = measured;
  let loudnormTargetI = finalTargetI;  // Target permanece o original
  let loudnormTargetTP = targetTP;     // Target TP padrão
  
  const deltaForLoudnorm = finalTargetI - measured.input_i;
  
  if (debug) {
    console.error(`[DEBUG] [GAIN STAGING] Pre-gain already applied in temp file (renderWithPreGain=${renderWithPreGain.toFixed(2)} dB)`);
    console.error(`[DEBUG] [GAIN STAGING] Measured LUFS (após EQ+Pre-Gain+Pre-Limiter): ${measured.input_i.toFixed(2)} LUFS`);
    console.error(`[DEBUG] [GAIN STAGING] Measured TP (após EQ+Pre-Gain+Pre-Limiter): ${measured.input_tp.toFixed(2)} dBTP`);
    console.error(`[DEBUG] [GAIN STAGING] Remaining delta for loudnorm: ${deltaForLoudnorm.toFixed(2)} LU`);
    console.error(`[DEBUG] [GAIN STAGING] Loudnorm target LUFS: ${loudnormTargetI.toFixed(2)} LUFS`);
    console.error(`[DEBUG] [GAIN STAGING] Loudnorm target TP: ${loudnormTargetTP.toFixed(2)} dBTP`);
  }

  // Passo 2: Render two-pass (com SR preservado, pré-ganho e pre-limiter se necessário)
  if (debug) {
    console.error('[DEBUG] [2/5] Renderizando (two-pass + limiter, SR preservado)...');
    console.error(`[DEBUG] [RENDER] Arquivo a renderizar: ${audioToRender}`);
    console.error(`[DEBUG] [RENDER] EQ será aplicado no render: ${renderWithEQ !== null}`);
    console.error(`[DEBUG] [RENDER] Pre-Gain será aplicado no render: ${renderWithPreGain > 0} (${renderWithPreGain.toFixed(2)} dB)`);
    console.error(`[DEBUG] [RENDER] Pre-Limiter será aplicado no render: ${renderWithPreLimiter}`);
    console.error(`[DEBUG] Loudnorm LRA: usando measured ${measured.input_lra.toFixed(2)} LU (preserva dinâmica original)`);
  }
  console.error('[PIPELINE] Two-pass loudnorm using processed input (measurements match processing)');
  
  // CRITICAL: usedTP (7º param) é o que loudnorm usa de fato, targetTP (4º param) é apenas referência
  const renderResult = await renderTwoPass(audioToRender, outputPath, loudnormTargetI, targetTP, targetLRA, measuredForLoudnorm, loudnormTargetTP, strategy, inputSampleRate, renderWithPreGain, renderWithEQ, renderWithPreLimiter, debug);
  if (debug) console.error(`[DEBUG] Tempo: ${renderResult.duration}s`);

  // Passo 3: Validação com measure-audio.cjs (confiável para TP final)
  if (debug) console.error('[DEBUG] [3/5] Medindo resultado final (measure-audio.cjs)...');
  const finalMeasure = await measureWithOfficialScript(outputPath);
  
  if (debug) {
    console.error(`[DEBUG] Final LUFS: ${finalMeasure.lufs_i.toFixed(2)} LUFS`);
    console.error(`[DEBUG] Final TP: ${finalMeasure.true_peak_db.toFixed(2)} dBTP`);
  }

  // Validar LUFS
  const lufsError = Math.abs(finalMeasure.lufs_i - targetI);
  const lufsPass = lufsError <= LUFS_TOLERANCE;
  
  if (!lufsPass && debug) {
    console.error(`[DEBUG] Aviso: LUFS erro ${lufsError.toFixed(3)} LU > tolerancia ${LUFS_TOLERANCE} LU`);
  }

  // ============================================================
  // ETAPA 2: FALLBACK DE TRUE PEAK (se necessário)
  // ============================================================
  
  let fixApplied = false;
  let fixDetails = null;
  
  // Verificar se True Peak excede o ceiling
  if (finalMeasure.true_peak_db > targetTP) {
    if (debug) {
      console.error(`[DEBUG] True Peak ${finalMeasure.true_peak_db.toFixed(2)} dBTP > ceiling ${targetTP.toFixed(2)} dBTP`);
      console.error('[DEBUG] Aplicando fallback: fix-true-peak.cjs (gain-only)');
    }
    
    // Aplicar fix de TP
    fixDetails = await applyTruePeakFix(outputPath);
    fixApplied = fixDetails.fixed;
    
    if (fixApplied) {
      // Medir novamente após o fix
      if (debug) console.error('[DEBUG] Re-medindo após fix...');
      const finalMeasureAfterFix = await measureWithOfficialScript(outputPath);
      
      if (debug) {
        console.error(`[DEBUG] TP após fix: ${finalMeasureAfterFix.true_peak_db.toFixed(2)} dBTP`);
      }
      
      // Verificar se o fix resolveu
      if (finalMeasureAfterFix.true_peak_db > targetTP) {
        throw new Error(
          `True Peak ainda excede ceiling após fix: ${finalMeasureAfterFix.true_peak_db.toFixed(2)} > ${targetTP.toFixed(2)} dBTP`
        );
      }
      
      // Atualizar métricas finais
      finalMeasure.lufs_i = finalMeasureAfterFix.lufs_i;
      finalMeasure.true_peak_db = finalMeasureAfterFix.true_peak_db;
    }
  }
  
  if (debug) {
    console.error('[DEBUG] PROCESSAMENTO COMPLETO');
    console.error(`[DEBUG] Fix TP aplicado: ${fixApplied ? 'SIM' : 'NAO'}`);
  }
  
  // ============================================================
  // ETAPA 3: PROTEÇÃO AUDITIVA FINAL (IMPACT MODE)
  // ============================================================
  
  let modeResult = currentMode; // STREAMING | BALANCED | IMPACT
  let impactAborted = false;
  let abortReason = null;
  
  if (currentMode === 'IMPACT') {
    if (debug) console.error('[DEBUG] [IMPACT VALIDATION] Medindo proteções auditivas finais...');
    
    // Medir limiter gain reduction
    const limiterGR = await measureLimiterGainReduction(outputPath);
    if (debug) console.error(`[DEBUG] [IMPACT VALIDATION] Limiter GR: ${limiterGR.toFixed(2)} dB`);
    
    // Medir crest factor final
    const finalCrest = await measureFinalCrest(outputPath);
    if (debug) console.error(`[DEBUG] [IMPACT VALIDATION] Final Crest: ${finalCrest.toFixed(2)} dB`);
    
    // Validação 1: Limiter Overload
    if (limiterGR > 5.0) {
      console.error(`[IMPACT ABORTED: LIMITER OVERLOAD] limiterGR=${limiterGR.toFixed(2)}dB > 5.0dB threshold`);
      console.error('[IMPACT ABORTED] Motivo: Limiter aplicou gain reduction excessivo (pumping audível)');
      console.error('[IMPACT ABORTED] Recomendação: Use modo BALANCED para este material');
      impactAborted = true;
      abortReason = 'LIMITER_OVERLOAD';
      modeResult = 'IMPACT-LIMITED';
    }
    
    // Validação 2: Crest Collapse
    if (!impactAborted && finalCrest < 5.0) {
      console.error(`[IMPACT ABORTED: CREST COLLAPSE] finalCrest=${finalCrest.toFixed(2)}dB < 5.0dB threshold`);
      console.error('[IMPACT ABORTED] Motivo: Dinâmica colapsada (brick-wall limiting)');
      console.error('[IMPACT ABORTED] Recomendação: Use modo BALANCED para preservar qualidade');
      impactAborted = true;
      abortReason = 'CREST_COLLAPSE';
      modeResult = 'IMPACT-LIMITED';
    }
    
    // Log de aprovação se passou nas validações
    if (!impactAborted) {
      console.error(`[IMPACT APPROVED] limiterGR=${limiterGR.toFixed(2)}dB finalCrest=${finalCrest.toFixed(2)}dB (within safe thresholds)`);
    }
  }
  
  // Log final obrigatório de resultado do modo
  console.error(`[MODE RESULT] ${modeResult}`);
  
  // Log final de comportamento dos modos
  console.error('[MODE BEHAVIOR]');
  console.error('STREAMING: Natural preservation');
  console.error('BALANCED: Controlled loudness');
  console.error('IMPACT: Competitive loudness (may compress dynamics)');

  return {
    success: true,
    targetI: finalTargetI,
    originalTarget: originalTarget,
    targetAdjusted: Math.abs(finalTargetI - originalTarget) > 0.1,
    targetTP,
    usedTP: targetTP,
    pre_gain_db: preGainDb,
    dynamic_unstable: stability.unstableDynamics,
    pumping_risk: stability.pumpingRisk,
    sub_dominant: stability.subDominant,
    final_lufs: finalMeasure.lufs_i,
    final_tp: finalMeasure.true_peak_db,
    lufsError,
    tpError: finalMeasure.true_peak_db - targetTP,
    fallback_used: fixApplied,
    fix_applied: fixApplied,
    fix_details: fixDetails,
    duration: renderResult.duration,
    outputSize: renderResult.outputSize,
    measured_by: 'measure-audio',
    mode_result: modeResult,
    impact_aborted: impactAborted,
    abort_reason: abortReason,
    mix_class: mixClass
  };
}

/**
 * Wrapper legado para compatibilidade CLI
 */
function processAudio(config) {
  const { inputPath, outputPath, targetLufs, ceilingDbtp, mode, strategy } = config;

  return runTwoPassLoudnorm({
    inputPath,
    outputPath,
    targetI: targetLufs,
    targetTP: ceilingDbtp,
    targetLRA: 7,
    mode,
    strategy
  });
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const debug = process.env.DEBUG_PIPELINE === 'true';
  let eqTempFile = null;  // Arquivo temporário com EQ (para limpeza ao final)

  if (debug) {
    console.error('[DEBUG] AutoMaster V1 - Nucleo Tecnico');
  }

  // 1. Validar argumentos
  let config;
  try {
    config = validateArgs();
    if (debug) console.error('[DEBUG] Parametros validos');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  // 2. Verificar FFmpeg
  if (debug) console.error('[DEBUG] Verificando FFmpeg...');
  try {
    const ffmpegVersion = await checkFFmpeg();
    if (debug) console.error(`[DEBUG] FFmpeg encontrado: ${ffmpegVersion}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  // 2.5 Target LUFS já foi calculado pelo decision-engine no backend
  if (debug) console.error('[DEBUG] Usando target LUFS calculado pelo decision-engine...');
  
  if (!config.targetLufs) {
    console.error('Erro: target LUFS não fornecido. Este script deve ser chamado pelo backend com targetLUFS calculado.');
    process.exit(1);
  }

  if (debug) {
    console.error(`[DEBUG] Input: ${config.inputPath}`);
    console.error(`[DEBUG] Output: ${config.outputPath}`);
    console.error(`[DEBUG] Target LUFS: ${config.targetLufs} LUFS`);
    console.error(`[DEBUG] Ceiling: ${config.ceilingDbtp} dBTP`);
  }

  // 3. Processar áudio
  if (debug) console.error('[DEBUG] Iniciando processamento...');
  
  try {
    const result = await processAudio(config);
    
    if (debug) {
      console.error('[DEBUG] PROCESSAMENTO CONCLUIDO COM SUCESSO');
      console.error(`[DEBUG] Tempo: ${result.duration}s`);
      console.error(`[DEBUG] Output: ${config.outputPath}`);
      console.error(`[DEBUG] Tamanho: ${result.outputSize} KB`);
      console.error(`[DEBUG] Target LUFS: ${result.targetI} LUFS`);
      console.error(`[DEBUG] Final LUFS: ${result.final_lufs.toFixed(2)} LUFS (erro: ${result.lufsError.toFixed(3)} LU)`);
      console.error(`[DEBUG] Target TP: ${result.targetTP.toFixed(2)} dBTP`);
      console.error(`[DEBUG] Used TP: ${result.usedTP.toFixed(2)} dBTP ${result.fallbackUsed ? '(fallback)' : ''}`);
      console.error(`[DEBUG] Final TP: ${result.final_tp.toFixed(2)} dBTP`);
    }

    // JSON PURO NO STDOUT (sem prefixo, sem decoração)
    const jsonResult = {
      success: true,
      target_lufs: result.targetI,
      original_target: result.originalTarget,
      target_adjusted: result.targetAdjusted,
      target_tp: result.targetTP,
      used_tp: result.targetTP,
      pre_gain_db: result.pre_gain_db,
      dynamic_unstable: result.dynamic_unstable,
      pumping_risk: result.pumping_risk,
      sub_dominant: result.sub_dominant,
      final_lufs: result.final_lufs,
      final_tp: result.final_tp,
      lufs_error: result.lufsError,
      tp_error: result.tpError,
      fallback_used: result.fallback_used,
      fix_applied: result.fix_applied,
      measured_by: result.measured_by,
      duration: result.duration,
      output_size_kb: result.outputSize,
      mode_result: result.mode_result,
      impact_aborted: result.impact_aborted,
      abort_reason: result.abort_reason,
      mix_class: result.mix_class
    };
    
    // Log de resultado final para fácil filtragem
    console.error(`[RESULT] final_lufs=${result.final_lufs.toFixed(2)} final_tp=${result.final_tp.toFixed(2)} output=${config.outputPath}`);
    
    console.log(JSON.stringify(jsonResult));
    
    // Limpar arquivo temporário (se foi criado)
    if (eqTempFile && fs.existsSync(eqTempFile)) {
      if (debug) {
        console.error(`[DEBUG] [CLEANUP] Removendo arquivo temporário: ${eqTempFile}`);
      }
      try {
        fs.unlinkSync(eqTempFile);
      } catch (cleanupError) {
        // Não falhar se limpeza falhou
        if (debug) {
          console.error(`[DEBUG] [CLEANUP] Aviso: falha ao remover temporário: ${cleanupError.message}`);
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    if (debug) {
      console.error('[DEBUG] ERRO NO PROCESSAMENTO');
    }
    console.error(error.message);
    
    // Limpar arquivo temporário mesmo em caso de erro
    if (typeof eqTempFile !== 'undefined' && eqTempFile && fs.existsSync(eqTempFile)) {
      try {
        fs.unlinkSync(eqTempFile);
        if (debug) {
          console.error(`[DEBUG] [CLEANUP] Arquivo temporário removido após erro`);
        }
      } catch (cleanupError) {
        // Ignorar erro de limpeza
      }
    }
    
    process.exit(1);
  }
}

// Executar
main();
