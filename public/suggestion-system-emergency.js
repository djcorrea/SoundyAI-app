// 🚨 SISTEMA DE EMERGÊNCIA - SUGESTÕES FUNCIONAIS
// Versão simplificada que DEVE funcionar

(function() {
    'use strict';
    
    console.log('🚨 [EMERGÊNCIA] Carregando sistema de sugestões...');
    
    // Classe principal simplificada
    class SuggestionSystemEmergency {
        constructor() {
            console.log('🚨 [EMERGÊNCIA] Sistema inicializado');
        }
        
        process(analysis, referenceData) {
            console.log('🚨 [EMERGÊNCIA] Processando sugestões...');
            
            if (!analysis?.technicalData || !referenceData) {
                console.warn('🚨 [EMERGÊNCIA] Dados inválidos');
                return { suggestions: [] };
            }
            
            const suggestions = [];
            const tech = analysis.technicalData;
            const ref = referenceData;
            
            // LUFS
            if (typeof tech.lufs === 'number' && typeof ref.lufs_target === 'number') {
                const delta = tech.lufs - ref.lufs_target;
                const tolerance = ref.tol_lufs || 1.0;
                
                if (Math.abs(delta) > tolerance) {
                    suggestions.push({
                        metric: 'lufs',
                        measured: tech.lufs,
                        target: ref.lufs_target,
                        delta: delta,
                        direction: delta > 0 ? 'reduce' : 'increase',
                        unit: 'LUFS',
                        problem: `Volume ${delta > 0 ? 'muito alto' : 'muito baixo'}: ${tech.lufs.toFixed(1)} LUFS`,
                        explanation: `Você está em ${tech.lufs.toFixed(1)} LUFS, mas o ideal para ${ref.genre || 'este gênero'} é ${ref.lufs_target.toFixed(1)} LUFS. ${delta > 0 ? 'Volume alto pode causar fadiga auditiva.' : 'Volume baixo reduz o impacto.'}`,
                        solution: `${delta > 0 ? 'Reduzir' : 'Aumentar'} o volume em ${Math.abs(delta).toFixed(1)} LUFS usando um limitador ou compressor.`
                    });
                }
            }
            
            // True Peak
            if (typeof tech.true_peak === 'number' && typeof ref.true_peak_target === 'number') {
                const excess = tech.true_peak - ref.true_peak_target;
                
                if (excess > 0) {
                    suggestions.push({
                        metric: 'true_peak',
                        measured: tech.true_peak,
                        target: ref.true_peak_target,
                        delta: excess,
                        direction: 'reduce',
                        unit: 'dBTP',
                        problem: `True Peak muito alto: ${tech.true_peak.toFixed(1)} dBTP`,
                        explanation: `Seu True Peak está em ${tech.true_peak.toFixed(1)} dBTP, mas deve ficar abaixo de ${ref.true_peak_target.toFixed(1)} dBTP para evitar distorção digital.`,
                        solution: `Reduzir o True Peak em ${excess.toFixed(1)} dBTP usando um limitador true-peak.`
                    });
                }
            }
            
            // Dynamic Range
            if (typeof tech.dr === 'number' && typeof ref.dr_target === 'number') {
                const delta = tech.dr - ref.dr_target;
                const tolerance = ref.tol_dr || 1.5;
                
                if (Math.abs(delta) > tolerance) {
                    suggestions.push({
                        metric: 'dr',
                        measured: tech.dr,
                        target: ref.dr_target,
                        delta: delta,
                        direction: delta > 0 ? 'reduce' : 'increase',
                        unit: 'dB',
                        problem: `Dinâmica ${delta > 0 ? 'muito alta' : 'muito baixa'}: ${tech.dr.toFixed(1)} dB`,
                        explanation: `Sua faixa tem DR=${tech.dr.toFixed(1)} dB, mas o ideal para ${ref.genre || 'este gênero'} é ${ref.dr_target.toFixed(1)} dB. ${delta > 0 ? 'DR alto pode deixar a faixa inconsistente.' : 'DR baixo remove a dinâmica natural.'}`,
                        solution: `${delta > 0 ? 'Comprimir mais' : 'Comprimir menos'} para ajustar a dinâmica em ${Math.abs(delta).toFixed(1)} dB.`
                    });
                }
            }
            
            // Stereo Correlation
            if (typeof tech.stereo === 'number' && typeof ref.stereo_target === 'number') {
                const delta = tech.stereo - ref.stereo_target;
                const tolerance = ref.tol_stereo || 0.15;
                
                if (Math.abs(delta) > tolerance) {
                    suggestions.push({
                        metric: 'stereo',
                        measured: tech.stereo,
                        target: ref.stereo_target,
                        delta: delta,
                        direction: delta > 0 ? 'reduce' : 'increase',
                        unit: '',
                        problem: `Correlação estéreo ${delta > 0 ? 'muito alta' : 'muito baixa'}: ${tech.stereo.toFixed(2)}`,
                        explanation: `Sua correlação estéreo é ${tech.stereo.toFixed(2)}, mas o ideal para ${ref.genre || 'este gênero'} é ${ref.stereo_target.toFixed(2)}. ${delta > 0 ? 'Excesso de width pode causar problemas em mono.' : 'Imagem muito estreita reduz a espacialidade.'}`,
                        solution: `${delta > 0 ? 'Reduzir' : 'Aumentar'} a largura estéreo usando plugins de width ou mid/side.`
                    });
                }
            }
            
            console.log(`🚨 [EMERGÊNCIA] ${suggestions.length} sugestões geradas`);
            
            return {
                suggestions: suggestions,
                _suggestionMetadata: {
                    processingTimeMs: 1,
                    genre: ref.genre,
                    emergency: true
                }
            };
        }
    }
    
    // Exportar globalmente
    if (typeof window !== 'undefined') {
        // 🎯 PRIORIDADE: Usar EnhancedSuggestionEngine se disponível
        if (typeof window.EnhancedSuggestionEngine !== 'undefined') {
            console.log('🎯 [EMERGÊNCIA] ✅ EnhancedSuggestionEngine encontrado - usando versão avançada');
            
            class HybridSuggestionSystem {
                constructor() {
                    this.enhancedEngine = new window.EnhancedSuggestionEngine();
                    this.emergencyEngine = new SuggestionSystemEmergency();
                    console.log('🎯 [HÍBRIDO] Sistema híbrido inicializado');
                }
                
                process(analysis, referenceData) {
                    console.log('🎯 [HÍBRIDO] Processando com engine avançado...');
                    
                    try {
                        // Tentar usar o engine avançado primeiro
                        const result = this.enhancedEngine.processAnalysis(analysis, referenceData);
                        
                        console.log('🎯 [HÍBRIDO] Engine avançado resultado:', {
                            suggestions: result.suggestions?.length || 0,
                            hasAuditLog: !!result.auditLog,
                            processingTime: result.enhancedMetrics?.processingTimeMs
                        });
                        
                        // Se obteve sugestões, usar resultado avançado
                        if (result.suggestions && result.suggestions.length > 0) {
                            console.log('✅ [HÍBRIDO] Usando resultado do engine avançado');
                            return result;
                        } else {
                            console.warn('⚠️ [HÍBRIDO] Engine avançado não gerou sugestões - usando fallback');
                            return this.emergencyEngine.process(analysis, referenceData);
                        }
                        
                    } catch (error) {
                        console.error('❌ [HÍBRIDO] Erro no engine avançado:', error);
                        console.log('🔄 [HÍBRIDO] Usando sistema de emergência...');
                        return this.emergencyEngine.process(analysis, referenceData);
                    }
                }
            }
            
            window.suggestionSystem = new HybridSuggestionSystem();
            
        } else {
            console.log('🚨 [EMERGÊNCIA] EnhancedSuggestionEngine não encontrado - usando sistema simples');
            window.suggestionSystem = new SuggestionSystemEmergency();
        }
        
        window.SuggestionSystemUnified = SuggestionSystemEmergency;
        window.USE_UNIFIED_SUGGESTIONS = true;
        console.log('🚨 [EMERGÊNCIA] Sistema disponível globalmente');
        console.log('✅ window.suggestionSystem:', typeof window.suggestionSystem);
        console.log('✅ window.suggestionSystem.process:', typeof window.suggestionSystem.process);
    }
    
})();