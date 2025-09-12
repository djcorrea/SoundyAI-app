/**
 * 🔍 AUDITORIA CRÍTICA - DIAGNÓSTICO VALORES NULL
 * 
 * Investigação urgente para resolver problema de métricas não aparecendo
 */

console.log('🚨 AUDITORIA CRÍTICA: INVESTIGANDO VALORES NULL NAS MÉTRICAS');

// 1. VERIFICAR SE BACKEND ESTÁ RODANDO
async function verificarBackend() {
    try {
        console.log('🌐 Testando conexão com backend...');
        
        // Tentar várias portas possíveis
        const portas = [3000, 8080, 5000, 8000];
        
        for (const porta of portas) {
            try {
                const response = await fetch(`http://localhost:${porta}/health`);
                if (response.ok) {
                    const text = await response.text();
                    console.log(`✅ Backend encontrado na porta ${porta}:`, text);
                    return porta;
                }
            } catch (e) {
                console.log(`❌ Porta ${porta} não responde`);
            }
        }
        
        console.error('🚨 PROBLEMA CRÍTICO: Nenhum backend encontrado!');
        return null;
    } catch (error) {
        console.error('🚨 Erro ao verificar backend:', error);
        return null;
    }
}

// 2. TESTAR ANÁLISE DIRETA (frontend)
function testarAnaliseLocal() {
    console.log('🧪 Testando análise local no frontend...');
    
    if (typeof window !== 'undefined' && window.audioAnalyzer) {
        console.log('✅ audioAnalyzer encontrado');
        
        // Verificar métodos disponíveis
        const metodos = Object.getOwnPropertyNames(window.audioAnalyzer.__proto__);
        console.log('🔍 Métodos disponíveis no audioAnalyzer:', metodos);
        
        return true;
    } else {
        console.error('❌ audioAnalyzer não encontrado');
        return false;
    }
}

// 3. INTERCEPTAR E AUDITAR JOB STATUS
let ultimoJobId = null;
let statusJob = {};

const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const [url, options] = args;
    
    // Interceptar criação de job
    if (url.includes('/upload') && options?.method === 'POST') {
        console.log('📤 [UPLOAD] Iniciando upload de arquivo');
    }
    
    // Interceptar verificação de status
    if (url.includes('/api/jobs/')) {
        const jobId = url.split('/').pop();
        ultimoJobId = jobId;
        
        const response = await originalFetch(...args);
        const clonedResponse = response.clone();
        
        try {
            const data = await clonedResponse.json();
            statusJob[jobId] = data;
            
            console.log(`📊 [JOB ${jobId}] Status:`, data.status);
            
            if (data.status === 'completed' && data.result) {
                console.group(`🎯 [JOB ${jobId}] ANÁLISE COMPLETA DOS RESULTADOS`);
                
                // Análise detalhada dos dados retornados
                console.log('🔍 Estrutura completa:', Object.keys(data.result));
                
                // Verificar onde estão as métricas
                const tecnicos = data.result.technicalData || data.result.metrics || {};
                console.log('📊 Dados técnicos encontrados:', Object.keys(tecnicos));
                
                // Verificar valores específicos que aparecem como null
                const metricas = {
                    peak: tecnicos.peak || tecnicos.peak_db,
                    rms: tecnicos.rms || tecnicos.rms_level,
                    lufs: tecnicos.lufs_integrated || tecnicos.lufs,
                    truePeak: tecnicos.truePeakDbtp || tecnicos.true_peak,
                    dynamicRange: tecnicos.dynamicRange || tecnicos.dynamic_range
                };
                
                console.log('🎯 MÉTRICAS ESSENCIAIS:');
                Object.entries(metricas).forEach(([nome, valor]) => {
                    const status = Number.isFinite(valor) ? '✅' : '❌';
                    console.log(`${status} ${nome}:`, valor);
                });
                
                // Verificar se pipeline backend foi usado
                if (data.result.usedFallback) {
                    console.warn('⚠️ BACKEND USOU FALLBACK - Pipeline principal falhou!');
                }
                
                // Verificar phases do pipeline
                if (data.result.phase1) console.log('📊 Phase 1 (decode):', !!data.result.phase1);
                if (data.result.phase2) console.log('📊 Phase 2 (segment):', !!data.result.phase2);
                if (data.result.phase3) console.log('📊 Phase 3 (metrics):', !!data.result.phase3);
                
                console.groupEnd();
                
                // Gerar relatório automaticamente
                setTimeout(() => gerarRelatorioFinal(data.result), 1000);
            }
            
            if (data.status === 'failed') {
                console.error(`❌ [JOB ${jobId}] FALHOU:`, data.error);
            }
            
        } catch (e) {
            console.warn('⚠️ Erro ao parsear resposta do job:', e);
        }
        
        return response;
    }
    
    return originalFetch(...args);
};

// 4. GERAR RELATÓRIO FINAL COM DIAGNÓSTICO
function gerarRelatorioFinal(dadosBackend) {
    console.group('🎯 RELATÓRIO FINAL - DIAGNÓSTICO COMPLETO');
    
    console.log('📋 RESUMO DA INVESTIGAÇÃO:');
    
    // 1. Status do Backend
    console.log('\n🌐 BACKEND:');
    verificarBackend().then(porta => {
        if (porta) {
            console.log(`✅ Backend funcionando na porta ${porta}`);
        } else {
            console.error('❌ Backend não encontrado - PROBLEMA CRÍTICO!');
        }
    });
    
    // 2. Status do Frontend
    console.log('\n💻 FRONTEND:');
    const temAnalyzer = testarAnaliseLocal();
    console.log(temAnalyzer ? '✅ Analyzer frontend OK' : '❌ Analyzer frontend ausente');
    
    // 3. Status das Métricas
    console.log('\n📊 MÉTRICAS:');
    if (dadosBackend) {
        const tech = dadosBackend.technicalData || {};
        const metricas = [
            ['Peak', tech.peak],
            ['RMS', tech.rms || tech.rmsLevel],
            ['LUFS', tech.lufsIntegrated],
            ['True Peak', tech.truePeakDbtp],
            ['Dynamic Range', tech.dynamicRange]
        ];
        
        let metricasValidas = 0;
        metricas.forEach(([nome, valor]) => {
            const valida = Number.isFinite(valor);
            if (valida) metricasValidas++;
            console.log(`${valida ? '✅' : '❌'} ${nome}: ${valor}`);
        });
        
        console.log(`\n📈 RESULTADO: ${metricasValidas}/${metricas.length} métricas válidas`);
        
        if (metricasValidas === 0) {
            console.error('🚨 PROBLEMA IDENTIFICADO: Backend não está calculando métricas!');
            console.log('💡 POSSÍVEIS CAUSAS:');
            console.log('   1. Pipeline de análise quebrado');
            console.log('   2. Arquivos de áudio corrompidos/incompatíveis');
            console.log('   3. Dependências faltando no backend');
            console.log('   4. Worker não processando corretamente');
        } else if (metricasValidas < metricas.length) {
            console.warn('⚠️ PROBLEMA PARCIAL: Algumas métricas não estão sendo calculadas');
        } else {
            console.log('✅ Todas as métricas sendo calculadas corretamente');
        }
    } else {
        console.error('❌ Nenhum dado de análise recebido do backend');
    }
    
    // 4. Status da UI
    console.log('\n🎨 INTERFACE:');
    setTimeout(() => {
        const modal = document.getElementById('modalTechnicalData');
        if (modal) {
            const valores = modal.querySelectorAll('.value');
            const vazios = Array.from(valores).filter(el => 
                ['—', 'N/A', '', '⏳'].includes(el.textContent.trim())
            );
            
            console.log(`📺 Valores na UI: ${valores.length - vazios.length}/${valores.length} preenchidos`);
            
            if (vazios.length > 0) {
                console.warn('⚠️ Valores vazios na UI:', vazios.length);
            }
        }
    }, 2000);
    
    console.groupEnd();
}

// 5. INICIALIZAR AUDITORIA
console.log('🚀 Auditoria inicializada - interceptadores ativos');
console.log('💡 Faça upload de um arquivo para iniciar diagnóstico');

// Disponibilizar no window para debug manual
window.auditoriaCritica = {
    verificarBackend,
    testarAnaliseLocal,
    gerarRelatorioFinal,
    ultimoJob: () => statusJob[ultimoJobId],
    todosJobs: () => statusJob
};

console.log('✅ Use window.auditoriaCritica para debug manual');
