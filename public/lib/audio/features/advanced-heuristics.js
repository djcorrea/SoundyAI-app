// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

// 🎵 ANÁLISE DE HEURÍSTICAS AVANÇADAS
// Detecta sibilância, harshness, masking e outros artefatos baseados em análise espectral

class AdvancedHeuristicsAnalyzer {
    constructor() {
        // 🎛️ Configurações de detecção
        this.config = {
            sibilance: {
                freqRange: [6000, 9000],    // Faixa típica de sibilância
                thresholdDb: -20,           // Threshold relativo para detecção
                minDuration: 0.1,           // Duração mínima em segundos
                transientThreshold: 0.7     // Threshold para detecção de transientes vocais
            },
            harshness: {
                freqRange: [3000, 5000],    // Faixa de médios-altos agressivos
                thresholdDb: -15,           // Threshold relativo
                qFactor: 2.0,               // Q para análise narrow-band
                maskingThreshold: 10        // dB acima de bandas adjacentes
            },
            masking: {
                freqRange: [200, 400],      // Faixa de "lama"
                energyRatio: 0.3,           // Ratio de energia concentrada
                adjacentThreshold: 6        // dB acima de bandas adjacentes
            },
            clipDetection: {
                thresholdLinear: 0.98,      // 98% do full scale
                consecutiveSamples: 3,      // Amostras consecutivas
                minOccurrences: 10          // Ocorrências mínimas
            }
        };

        // 🎨 Pesos de confiança por tipo de detecção
        this.confidenceWeights = {
            sibilance: 0.9,     // Alta confiança quando detectada em transientes
            harshness: 0.8,     // Boa confiança em análise narrow-band
            masking: 0.7,       // Confiança moderada em detecção de lama
            clipping: 1.0       // Confiança máxima para clipagem
        };
    }

    /**
     * 🎤 Detectar sibilância em material vocal
     * @param {Object} spectralData - Dados espectrais (magnitude vs freq)
     * @param {Object} transientData - Dados de transientes (opcional)
     * @returns {Array} Lista de detecções de sibilância
     */
    detectSibilance(spectralData, transientData = null) {
        const detections = [];
        
        if (!spectralData?.freqBins || !spectralData?.magnitude) return detections;
        
        const { freqBins, magnitude } = spectralData;
        const { freqRange, thresholdDb, transientThreshold } = this.config.sibilance;
        
        // Encontrar bins na faixa de sibilância
        const sibilanceBins = [];
        for (let i = 0; i < freqBins.length; i++) {
            const freq = freqBins[i];
            if (freq >= freqRange[0] && freq <= freqRange[1]) {
                sibilanceBins.push({ bin: i, freq, mag: magnitude[i] });
            }
        }
        
        if (sibilanceBins.length === 0) return detections;
        
        // Calcular energia média na faixa
        const avgMag = sibilanceBins.reduce((sum, bin) => sum + bin.mag, 0) / sibilanceBins.length;
        const avgMagDb = 20 * Math.log10(avgMag + 1e-10);
        
        // Calcular energia de referência (bandas adjacentes)
        const refBins = [];
        for (let i = 0; i < freqBins.length; i++) {
            const freq = freqBins[i];
            if ((freq >= 4000 && freq < freqRange[0]) || (freq > freqRange[1] && freq <= 12000)) {
                refBins.push(magnitude[i]);
            }
        }
        
        const refMag = refBins.length > 0 ? refBins.reduce((a, b) => a + b, 0) / refBins.length : avgMag;
        const refMagDb = 20 * Math.log10(refMag + 1e-10);
        
        // Detectar sibilância se energia relativa alta
        const relativeDb = avgMagDb - refMagDb;
        if (relativeDb > thresholdDb) {
            // Encontrar frequência dominante na faixa
            const dominantBin = sibilanceBins.reduce((max, bin) => 
                bin.mag > max.mag ? bin : max
            );
            
            // Calcular confiança baseada em transientes (se disponíveis)
            let confidence = this.confidenceWeights.sibilance;
            if (transientData?.strength) {
                confidence *= Math.min(1.0, transientData.strength / transientThreshold);
            }
            
            detections.push({
                type: 'sibilance',
                frequency: Math.round(dominantBin.freq),
                intensity: relativeDb,
                confidence,
                action: `Aplicar de-esser ou EQ em ${Math.round(dominantBin.freq)}Hz`,
                technical: {
                    freqRange: freqRange,
                    relativeDb: +relativeDb.toFixed(1),
                    dominantFreq: Math.round(dominantBin.freq)
                }
            });
        }
        
        return detections;
    }

    /**
     * 🔥 Detectar harshness em médios-altos
     * @param {Object} spectralData - Dados espectrais
     * @returns {Array} Lista de detecções de harshness
     */
    detectHarshness(spectralData) {
        const detections = [];
        
        if (!spectralData?.freqBins || !spectralData?.magnitude) return detections;
        
        const { freqBins, magnitude } = spectralData;
        const { freqRange, thresholdDb, maskingThreshold } = this.config.harshness;
        
        // Análise em sub-bandas narrower para detectar picos agressivos
        const subBandWidth = 200; // Hz
        for (let centerFreq = freqRange[0]; centerFreq <= freqRange[1]; centerFreq += subBandWidth/2) {
            const lowFreq = centerFreq - subBandWidth/2;
            const highFreq = centerFreq + subBandWidth/2;
            
            // Encontrar bins na sub-banda
            const subBandBins = [];
            const adjacentBins = [];
            
            for (let i = 0; i < freqBins.length; i++) {
                const freq = freqBins[i];
                if (freq >= lowFreq && freq <= highFreq) {
                    subBandBins.push(magnitude[i]);
                } else if ((freq >= lowFreq - subBandWidth && freq < lowFreq) ||
                          (freq > highFreq && freq <= highFreq + subBandWidth)) {
                    adjacentBins.push(magnitude[i]);
                }
            }
            
            if (subBandBins.length === 0 || adjacentBins.length === 0) continue;
            
            // Calcular energia média da sub-banda vs adjacentes
            const subBandAvg = subBandBins.reduce((a, b) => a + b, 0) / subBandBins.length;
            const adjacentAvg = adjacentBins.reduce((a, b) => a + b, 0) / adjacentBins.length;
            
            const subBandDb = 20 * Math.log10(subBandAvg + 1e-10);
            const adjacentDb = 20 * Math.log10(adjacentAvg + 1e-10);
            const maskingDb = subBandDb - adjacentDb;
            
            // Detectar harshness se masking significativo
            if (maskingDb > maskingThreshold && subBandDb > thresholdDb) {
                detections.push({
                    type: 'harshness',
                    frequency: Math.round(centerFreq),
                    intensity: maskingDb,
                    confidence: this.confidenceWeights.harshness,
                    action: `Suavizar ${Math.round(centerFreq)}Hz com EQ (Q=${this.config.harshness.qFactor})`,
                    technical: {
                        centerFreq: Math.round(centerFreq),
                        maskingDb: +maskingDb.toFixed(1),
                        subBandDb: +subBandDb.toFixed(1),
                        adjacentDb: +adjacentDb.toFixed(1)
                    }
                });
            }
        }
        
        return detections;
    }

    /**
     * 🌫️ Detectar masking/lama nos médios
     * @param {Object} spectralData - Dados espectrais
     * @returns {Array} Lista de detecções de masking
     */
    detectMasking(spectralData) {
        const detections = [];
        
        if (!spectralData?.freqBins || !spectralData?.magnitude) return detections;
        
        const { freqBins, magnitude } = spectralData;
        const { freqRange, energyRatio, adjacentThreshold } = this.config.masking;
        
        // Calcular energia total do espectro
        const totalEnergy = magnitude.reduce((sum, mag) => sum + mag * mag, 0);
        
        // Calcular energia na faixa de masking
        let maskingEnergy = 0;
        let maskingBins = 0;
        for (let i = 0; i < freqBins.length; i++) {
            const freq = freqBins[i];
            if (freq >= freqRange[0] && freq <= freqRange[1]) {
                maskingEnergy += magnitude[i] * magnitude[i];
                maskingBins++;
            }
        }
        
        if (maskingBins === 0) return detections;
        
        // Verificar se energia está concentrada demais nesta faixa
        const energyConcentration = maskingEnergy / totalEnergy;
        if (energyConcentration > energyRatio) {
            // Calcular energia média vs bandas adjacentes
            const maskingAvg = Math.sqrt(maskingEnergy / maskingBins);
            
            // Bandas adjacentes (graves e agudos)
            let lowEnergy = 0, lowBins = 0;
            let highEnergy = 0, highBins = 0;
            
            for (let i = 0; i < freqBins.length; i++) {
                const freq = freqBins[i];
                if (freq >= 100 && freq < freqRange[0]) {
                    lowEnergy += magnitude[i] * magnitude[i];
                    lowBins++;
                } else if (freq > freqRange[1] && freq <= 800) {
                    highEnergy += magnitude[i] * magnitude[i];
                    highBins++;
                }
            }
            
            const lowAvg = lowBins > 0 ? Math.sqrt(lowEnergy / lowBins) : 0;
            const highAvg = highBins > 0 ? Math.sqrt(highEnergy / highBins) : 0;
            const adjacentAvg = (lowAvg + highAvg) / 2;
            
            if (adjacentAvg > 0) {
                const maskingDb = 20 * Math.log10(maskingAvg + 1e-10);
                const adjacentDb = 20 * Math.log10(adjacentAvg + 1e-10);
                const excessDb = maskingDb - adjacentDb;
                
                if (excessDb > adjacentThreshold) {
                    detections.push({
                        type: 'masking',
                        frequency: Math.round((freqRange[0] + freqRange[1]) / 2),
                        intensity: excessDb,
                        confidence: this.confidenceWeights.masking,
                        action: `Reduzir lama em ${freqRange[0]}-${freqRange[1]}Hz com EQ`,
                        technical: {
                            freqRange: freqRange,
                            energyConcentration: +(energyConcentration * 100).toFixed(1),
                            excessDb: +excessDb.toFixed(1),
                            maskingDb: +maskingDb.toFixed(1),
                            adjacentDb: +adjacentDb.toFixed(1)
                        }
                    });
                }
            }
        }
        
        return detections;
    }

    /**
     * 📊 Detectar clipping digital
     * @param {Float32Array} audioData - Dados de áudio
     * @returns {Array} Lista de detecções de clipping
     */
    detectClipping(audioData) {
        const detections = [];
        
        if (!audioData || audioData.length === 0) return detections;
        
        const { thresholdLinear, consecutiveSamples, minOccurrences } = this.config.clipDetection;
        
        let clipCount = 0;
        let consecutiveCount = 0;
        let maxConsecutive = 0;
        
        for (let i = 0; i < audioData.length; i++) {
            const sample = Math.abs(audioData[i]);
            
            if (sample >= thresholdLinear) {
                consecutiveCount++;
                clipCount++;
            } else {
                if (consecutiveCount >= consecutiveSamples) {
                    maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
                }
                consecutiveCount = 0;
            }
        }
        
        // Verificar última sequência
        if (consecutiveCount >= consecutiveSamples) {
            maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
        }
        
        if (clipCount >= minOccurrences && maxConsecutive >= consecutiveSamples) {
            const clipPercentage = (clipCount / audioData.length) * 100;
            
            detections.push({
                type: 'clipping',
                frequency: null, // N/A para clipping
                intensity: clipPercentage,
                confidence: this.confidenceWeights.clipping,
                action: 'Reduzir ganho ou aplicar limiter suave',
                technical: {
                    clipCount,
                    clipPercentage: +clipPercentage.toFixed(3),
                    maxConsecutive,
                    thresholdDb: +(20 * Math.log10(thresholdLinear)).toFixed(1)
                }
            });
        }
        
        return detections;
    }

    /**
     * 🎯 Análise completa de heurísticas
     * @param {Object} analysisData - Dados da análise de áudio
     * @returns {Array} Lista de todas as detecções
     */
    analyzeAll(analysisData) {
        const allDetections = [];
        
        try {
            // Detectar sibilância (se dados espectrais disponíveis)
            if (analysisData.spectralData) {
                const sibilanceDetections = this.detectSibilance(
                    analysisData.spectralData, 
                    analysisData.transientData
                );
                allDetections.push(...sibilanceDetections);
            }
            
            // Detectar harshness
            if (analysisData.spectralData) {
                const harshnessDetections = this.detectHarshness(analysisData.spectralData);
                allDetections.push(...harshnessDetections);
            }
            
            // Detectar masking
            if (analysisData.spectralData) {
                const maskingDetections = this.detectMasking(analysisData.spectralData);
                allDetections.push(...maskingDetections);
            }
            
            // Detectar clipping
            if (analysisData.audioBuffer) {
                const leftChannel = analysisData.audioBuffer.getChannelData(0);
                const clippingDetections = this.detectClipping(leftChannel);
                allDetections.push(...clippingDetections);
            }
            
        } catch (error) {
            warn('🚨 Erro na análise de heurísticas:', error);
        }
        
        // Ordenar por confiança e intensidade
        allDetections.sort((a, b) => {
            const scoreA = a.confidence * a.intensity;
            const scoreB = b.confidence * b.intensity;
            return scoreB - scoreA;
        });
        
        return allDetections;
    }

    /**
     * 🔍 Verificar condições específicas para heurísticas contextuais
     * @param {Object} metrics - Métricas básicas do áudio
     * @param {Object} spectralData - Dados espectrais
     * @returns {Array} Detecções contextuais
     */
    detectContextualIssues(metrics, spectralData) {
        const contextualDetections = [];
        
        // Sibilância só é relevante se há energia vocal
        if (spectralData && this.hasVocalContent(spectralData)) {
            const sibilanceDetections = this.detectSibilance(spectralData);
            // Só adicionar se intensidade alta (vocal confirmado)
            contextualDetections.push(...sibilanceDetections.filter(d => d.intensity > -15));
        }
        
        // Harshness em médios-altos só relevante se não é conteúdo instrumental percussivo
        if (spectralData && !this.isPercussiveContent(spectralData)) {
            const harshnessDetections = this.detectHarshness(spectralData);
            contextualDetections.push(...harshnessDetections);
        }
        
        return contextualDetections;
    }

    /**
     * 🎤 Heurística para detectar conteúdo vocal
     * @param {Object} spectralData - Dados espectrais
     * @returns {boolean} True se conteúdo vocal detectado
     */
    hasVocalContent(spectralData) {
        if (!spectralData?.freqBins || !spectralData?.magnitude) return false;
        
        // Buscar energia nas faixas de formantes vocais
        const formantRanges = [
            [300, 800],   // F1 típico
            [800, 2500],  // F2 típico  
            [2000, 3500]  // F3 típico
        ];
        
        let formantEnergy = 0;
        let totalEnergy = 0;
        
        for (let i = 0; i < spectralData.freqBins.length; i++) {
            const freq = spectralData.freqBins[i];
            const mag = spectralData.magnitude[i];
            
            totalEnergy += mag * mag;
            
            for (const [low, high] of formantRanges) {
                if (freq >= low && freq <= high) {
                    formantEnergy += mag * mag;
                    break;
                }
            }
        }
        
        // Se 30%+ da energia está nas faixas de formantes, provável vocal
        return totalEnergy > 0 && (formantEnergy / totalEnergy) > 0.3;
    }

    /**
     * 🥁 Heurística para detectar conteúdo percussivo
     * @param {Object} spectralData - Dados espectrais
     * @returns {boolean} True se conteúdo percussivo detectado
     */
    isPercussiveContent(spectralData) {
        if (!spectralData?.freqBins || !spectralData?.magnitude) return false;
        
        // Buscar energia em faixas típicas de percussão
        let lowEnergy = 0;  // 60-200 Hz (kick, toms)
        let midEnergy = 0;  // 200-2000 Hz (snare fundamental)
        let highEnergy = 0; // 8-15 kHz (cymbals, hihats)
        let totalEnergy = 0;
        
        for (let i = 0; i < spectralData.freqBins.length; i++) {
            const freq = spectralData.freqBins[i];
            const energy = spectralData.magnitude[i] * spectralData.magnitude[i];
            
            totalEnergy += energy;
            
            if (freq >= 60 && freq <= 200) {
                lowEnergy += energy;
            } else if (freq >= 200 && freq <= 2000) {
                midEnergy += energy;
            } else if (freq >= 8000 && freq <= 15000) {
                highEnergy += energy;
            }
        }
        
        if (totalEnergy === 0) return false;
        
        // Percussão tem distribuição característica com energia nos extremos
        const lowRatio = lowEnergy / totalEnergy;
        const highRatio = highEnergy / totalEnergy;
        
        return (lowRatio > 0.2 && highRatio > 0.1);
    }
}

// Instância global do analisador
window.AdvancedHeuristicsAnalyzer = AdvancedHeuristicsAnalyzer;
window.heuristicsAnalyzer = new AdvancedHeuristicsAnalyzer();

log('🎵 Advanced Heuristics Analyzer inicializado');
