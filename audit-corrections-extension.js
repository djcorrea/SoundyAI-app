// 🎯 CORREÇÕES AUDITORIA - EXTENSÕES PARA AUDIO-ANALYZER-INTEGRATION.JS
// Adicionar ao final do arquivo principal ou incluir via script separado

console.log('🎯 Carregando extensões das correções da auditoria...');

// 🎯 CORREÇÃO 1: Melhorar renderização de bandas espectrais
if (typeof window !== 'undefined') {
    // Sobrescrever função de renderização de referências
    const originalRenderReferenceComparisons = window.renderReferenceComparisons || function() {};
    
    window.renderReferenceComparisonsEnhanced = function(analysis) {
        console.log('🎯 [ENHANCED] Renderizando comparações com bandas expandidas');
        
        const container = document.getElementById('referenceComparisons');
        if (!container) return;
        
        const tech = analysis.technicalData || {};
        const sb = tech.spectral_balance || {};
        
        // 🎯 CORREÇÃO: Exibir todas as 6 bandas espectrais
        const fullBandEntries = [
            { key: 'sub', label: 'SUB (20-60Hz)', value: sb.sub },
            { key: 'bass', label: 'BASS (60-250Hz)', value: sb.bass },
            { key: 'mids', label: 'MIDS (250Hz-4kHz)', value: sb.mids },
            { key: 'treble', label: 'TREBLE (4k-12kHz)', value: sb.treble },
            { key: 'presence', label: 'PRESENCE (4k-8kHz)', value: sb.presence },
            { key: 'air', label: 'AIR (12k-20kHz)', value: sb.air }
        ];
        
        let bandsHTML = '';
        fullBandEntries.forEach(({key, label, value}) => {
            if (value !== undefined && value !== null) {
                const percentage = (value * 100).toFixed(1);
                const energyDb = value > 0 ? (20 * Math.log10(value)).toFixed(1) : '-60.0';
                bandsHTML += `
                    <tr>
                        <td>${label}</td>
                        <td>${percentage}% (${energyDb}dB)</td>
                        <td>--</td>
                        <td>--</td>
                    </tr>
                `;
            }
        });
        
        container.innerHTML = `
            <div class="card" style="margin-top:12px;">
                <div class="card-title">🎯 Análise Espectral Completa (6 Bandas)</div>
                <table class="ref-compare-table">
                    <thead>
                        <tr><th>Banda</th><th>Energia</th><th>Alvo</th><th>Δ</th></tr>
                    </thead>
                    <tbody>${bandsHTML || '<tr><td colspan="4">Dados espectrais não disponíveis</td></tr>'}</tbody>
                </table>
            </div>
        `;
        
        console.log('✅ [ENHANCED] Bandas espectrais renderizadas:', fullBandEntries.length);
    };
}

// 🎯 CORREÇÃO 2: Melhorar exibição de metadata
if (typeof window !== 'undefined') {
    window.injectMetadataCard = function(analysis) {
        console.log('🎯 [ENHANCED] Injetando card de metadata completa');
        
        const technicalDataContainer = document.getElementById('modalTechnicalData');
        if (!technicalDataContainer) return;
        
        const tech = analysis.technicalData || {};
        const meta = analysis.metadata || {};
        const perf = analysis.performance || {};
        
        // Calcular metadata inteligentemente
        const sampleRate = meta.sampleRate || tech.sampleRate || 
                          (tech.samplesProcessed && perf.totalTimeMs ? 
                           Math.round(tech.samplesProcessed / (perf.totalTimeMs / 1000)) : 48000);
        
        const channels = meta.channels || tech.channels || 
                        (Number.isFinite(tech.stereoCorrelation) ? 2 : 2);
        
        let duration = meta.duration || meta.durationSec || tech.durationSec;
        if (!duration && tech.samplesProcessed && sampleRate) {
            duration = tech.samplesProcessed / sampleRate;
        }
        
        const metadataHTML = `
            <div class="card" style="margin-top: 12px;" id="enhancedMetadataCard">
                <div class="card-title">📊 Metadata & Performance Completa</div>
                <div class="data-row">
                    <span class="label">Sample Rate</span>
                    <span class="value">${sampleRate?.toLocaleString()} Hz</span>
                </div>
                <div class="data-row">
                    <span class="label">Canais</span>
                    <span class="value">${channels === 1 ? 'Mono' : channels === 2 ? 'Estéreo' : `${channels} canais`}</span>
                </div>
                <div class="data-row">
                    <span class="label">Duração</span>
                    <span class="value">${duration ? `${Math.floor(duration/60)}:${Math.floor(duration%60).toString().padStart(2,'0')}` : 'N/A'}</span>
                </div>
                ${perf.totalTimeMs ? `
                <div class="data-row">
                    <span class="label">Tempo Processamento</span>
                    <span class="value">${(perf.totalTimeMs / 1000).toFixed(1)}s</span>
                </div>` : ''}
                ${tech.fftOperations ? `
                <div class="data-row">
                    <span class="label">Operações FFT</span>
                    <span class="value">${tech.fftOperations.toLocaleString()}</span>
                </div>` : ''}
                ${tech.samplesProcessed ? `
                <div class="data-row">
                    <span class="label">Samples Processadas</span>
                    <span class="value">${(tech.samplesProcessed / 1000000).toFixed(1)}M</span>
                </div>` : ''}
                ${perf.backendPhase ? `
                <div class="data-row">
                    <span class="label">Pipeline</span>
                    <span class="value">${perf.backendPhase}</span>
                </div>` : ''}
            </div>
        `;
        
        // Remover card anterior se existir
        const existingCard = document.getElementById('enhancedMetadataCard');
        if (existingCard) existingCard.remove();
        
        technicalDataContainer.insertAdjacentHTML('beforeend', metadataHTML);
        console.log('✅ [ENHANCED] Card de metadata injetado');
    };
}

// 🎯 CORREÇÃO 3: Melhorar exibição de frequências dominantes  
if (typeof window !== 'undefined') {
    window.injectFrequenciesCard = function(analysis) {
        console.log('🎯 [ENHANCED] Injetando card de frequências dominantes');
        
        const technicalDataContainer = document.getElementById('modalTechnicalData');
        if (!technicalDataContainer) return;
        
        const dominantFreqs = analysis.technicalData?.dominantFrequencies || [];
        if (dominantFreqs.length === 0) return;
        
        const top5 = dominantFreqs.slice(0, 5);
        const extras = dominantFreqs.slice(5, 12);
        
        let frequenciesHTML = `
            <div class="card" style="margin-top: 12px;" id="enhancedFrequenciesCard">
                <div class="card-title">🎵 Frequências Dominantes (${dominantFreqs.length} detectadas)</div>
                <div style="margin-bottom: 12px;">
                    <strong>Top 5 Frequências:</strong><br>
        `;
        
        top5.forEach((freq, idx) => {
            const prominence = ['🎯', '📈', '📊', '▫️', '▫️'][idx];
            const amplitude = freq.amplitude ? ` ${freq.amplitude.toFixed(1)}dB` : '';
            const occurrences = freq.occurrences ? ` (${freq.occurrences}x)` : '';
            frequenciesHTML += `${prominence} ${Math.round(freq.frequency)}Hz${occurrences}${amplitude}<br>`;
        });
        
        if (extras.length > 0) {
            frequenciesHTML += `
                </div>
                <div style="margin-top: 12px; font-size: 11px; opacity: 0.8;">
                    <strong>Frequências Adicionais:</strong><br>
                    ${extras.map(f => `${Math.round(f.frequency)}Hz`).join(' • ')}
                </div>
            `;
        }
        
        frequenciesHTML += '</div>';
        
        // Remover card anterior se existir
        const existingCard = document.getElementById('enhancedFrequenciesCard');
        if (existingCard) existingCard.remove();
        
        technicalDataContainer.insertAdjacentHTML('beforeend', frequenciesHTML);
        console.log('✅ [ENHANCED] Card de frequências injetado:', top5.length, 'principais +', extras.length, 'extras');
    };
}

// 🎯 AUTO-ATIVAÇÃO: Interceptar displayModalResults original
if (typeof window !== 'undefined') {
    window.applyAuditCorrections = function(analysis) {
        console.log('🎯 [ENHANCED] Aplicando correções da auditoria...');
        
        // Aguardar um pouco para o modal ser renderizado
        setTimeout(() => {
            try {
                // Aplicar todas as correções
                window.renderReferenceComparisonsEnhanced(analysis);
                window.injectMetadataCard(analysis);
                window.injectFrequenciesCard(analysis);
                
                console.log('✅ [ENHANCED] Todas as correções aplicadas com sucesso!');
                
                // Mostrar notificação de sucesso
                const notification = document.createElement('div');
                notification.innerHTML = `
                    <div style="position: fixed; top: 20px; right: 20px; background: #28a745; color: white; 
                         padding: 12px 20px; border-radius: 8px; z-index: 10000; font-size: 14px;
                         box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
                        ✅ Interface Expandida: Exibindo todos os dados calculados!
                    </div>
                `;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    if (notification.parentNode) notification.parentNode.removeChild(notification);
                }, 5000);
                
            } catch (error) {
                console.error('❌ [ENHANCED] Erro ao aplicar correções:', error);
            }
        }, 1000);
    };
    
    // Hook no displayModalResults se existir
    const originalDisplayModalResults = window.displayModalResults;
    if (originalDisplayModalResults) {
        window.displayModalResults = function(analysis) {
            // Chamar função original
            originalDisplayModalResults.call(this, analysis);
            
            // Aplicar nossas correções
            window.applyAuditCorrections(analysis);
        };
        console.log('✅ [ENHANCED] Hook instalado em displayModalResults');
    }
}

console.log('🎉 Correções da auditoria carregadas com sucesso!');

// Expor função global para ativação manual
if (typeof window !== 'undefined') {
    window.AUDIT_CORRECTIONS_LOADED = true;
}
