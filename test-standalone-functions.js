/**
 * TESTE DE DEBUG - Verificar porque as funções standalone retornam null
 */

console.log('🔍 TESTE DE DEBUG - Funções Standalone');

// Simular dados como se viessem do FFT
const mockMagnitudeSpectrum = new Float32Array(2048);
for (let i = 0; i < mockMagnitudeSpectrum.length; i++) {
    // Simular espectro com picos em algumas frequências
    const freq = (i * 48000) / (2 * 2048);
    if (freq > 80 && freq < 120) mockMagnitudeSpectrum[i] = 0.8; // Bass
    if (freq > 400 && freq < 500) mockMagnitudeSpectrum[i] = 0.9; // Mid
    if (freq > 1000 && freq < 1200) mockMagnitudeSpectrum[i] = 0.7; // High
    else mockMagnitudeSpectrum[i] = 0.1 + Math.random() * 0.2;
}

const mockFrequencyBins = new Float32Array(2048);
for (let i = 0; i < mockFrequencyBins.length; i++) {
    mockFrequencyBins[i] = (i * 48000) / (2 * 2048);
}

console.log('📊 Mock data criados:');
console.log('- Magnitude spectrum:', mockMagnitudeSpectrum.length, 'samples');
console.log('- Frequency bins:', mockFrequencyBins.length, 'bins');
console.log('- Max magnitude:', Math.max(...mockMagnitudeSpectrum));

// Teste 1: calculateDominantFrequencies
console.log('\n🔍 TESTE 1: calculateDominantFrequencies');
try {
    // Simular a função
    function testCalculateDominantFrequencies(magnitudeSpectrum, sampleRate, fftSize) {
        console.log('📥 Inputs:', {
            spectrumLength: magnitudeSpectrum?.length,
            sampleRate,
            fftSize,
            isArray: Array.isArray(magnitudeSpectrum),
            firstValues: magnitudeSpectrum?.slice(0, 5)
        });
        
        if (!magnitudeSpectrum || !Array.isArray(magnitudeSpectrum) || magnitudeSpectrum.length === 0) {
            console.warn('❌ Spectrum inválido');
            return {
                value: null,
                unit: 'Hz',
                detailed: { primary: null, secondary: null, peaks: [] }
            };
        }
        
        // Encontrar picos simples
        const peaks = [];
        const threshold = 0.5;
        
        for (let i = 1; i < magnitudeSpectrum.length - 1; i++) {
            if (magnitudeSpectrum[i] > threshold && 
                magnitudeSpectrum[i] > magnitudeSpectrum[i-1] && 
                magnitudeSpectrum[i] > magnitudeSpectrum[i+1]) {
                
                const frequency = (i * sampleRate) / (2 * magnitudeSpectrum.length);
                peaks.push({
                    frequency: frequency,
                    magnitude: magnitudeSpectrum[i],
                    bin: i
                });
            }
        }
        
        console.log('🔍 Picos encontrados:', peaks.length);
        
        if (peaks.length === 0) {
            return {
                value: null,
                unit: 'Hz',
                detailed: { primary: null, secondary: null, peaks: [] }
            };
        }
        
        // Ordenar por magnitude
        peaks.sort((a, b) => b.magnitude - a.magnitude);
        
        const primary = peaks[0]?.frequency || null;
        const secondary = peaks[1]?.frequency || null;
        
        console.log('✅ Resultado:', { primary, secondary, totalPeaks: peaks.length });
        
        return {
            value: primary,
            unit: 'Hz',
            detailed: {
                primary: primary,
                secondary: secondary,
                peaks: peaks.slice(0, 5)
            }
        };
    }
    
    const result1 = testCalculateDominantFrequencies(
        Array.from(mockMagnitudeSpectrum), 
        48000, 
        4096
    );
    console.log('📊 Resultado dominantFrequencies:', result1);
    
} catch (error) {
    console.error('❌ Erro testCalculateDominantFrequencies:', error);
}

// Teste 2: calculateSpectralUniformity
console.log('\n🔍 TESTE 2: calculateSpectralUniformity');
try {
    function testCalculateSpectralUniformity(magnitudeSpectrum, frequencyBins, sampleRate) {
        console.log('📥 Inputs:', {
            spectrumLength: magnitudeSpectrum?.length,
            binsLength: frequencyBins?.length,
            sampleRate
        });
        
        if (!magnitudeSpectrum || !frequencyBins) {
            console.warn('❌ Dados insuficientes');
            return null;
        }
        
        // Calcular variância simples
        const mean = magnitudeSpectrum.reduce((sum, val) => sum + val, 0) / magnitudeSpectrum.length;
        const variance = magnitudeSpectrum.reduce((sum, val) => sum + (val - mean) ** 2, 0) / magnitudeSpectrum.length;
        const coefficient = Math.sqrt(variance) / mean;
        
        console.log('📊 Estatísticas:', { mean, variance, coefficient });
        
        const result = {
            uniformity: {
                coefficient: coefficient,
                standardDeviation: Math.sqrt(variance),
                variance: variance
            },
            score: Math.max(0, 1 - coefficient),
            rating: coefficient < 0.2 ? 'excellent' : coefficient < 0.4 ? 'good' : 'fair'
        };
        
        console.log('✅ Resultado spectralUniformity:', result);
        return result;
    }
    
    const result2 = testCalculateSpectralUniformity(
        Array.from(mockMagnitudeSpectrum),
        Array.from(mockFrequencyBins),
        48000
    );
    console.log('📊 Resultado spectralUniformity:', result2);
    
} catch (error) {
    console.error('❌ Erro testCalculateSpectralUniformity:', error);
}

console.log('\n✅ TESTE CONCLUÍDO - Verificar resultados acima');