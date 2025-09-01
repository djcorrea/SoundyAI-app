/**
 * 🔧 VALIDADOR DE COMPATIBILIDADE VERCEL
 * 
 * Verifica se todas as funcionalidades da Fase 1 funcionarão na Vercel
 */

const VercelCompatibilityChecker = {
    
    async checkAll() {
        console.log('🔧 VERIFICANDO COMPATIBILIDADE COM VERCEL');
        console.log('═══════════════════════════════════════════════════════');
        
        const results = {
            environment: this.checkEnvironment(),
            webAPIs: this.checkWebAPIs(),
            scripts: await this.checkScriptLoading(),
            features: this.checkFeatures(),
            performance: this.checkPerformance()
        };
        
        this.generateReport(results);
        return results;
    },
    
    checkEnvironment() {
        console.log('🌍 Verificando ambiente...');
        
        const env = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            url: window.location.href,
            protocol: window.location.protocol,
            hostname: window.location.hostname
        };
        
        // Detectar se está na Vercel
        const isVercel = window.location.hostname.includes('vercel.app') || 
                        window.location.hostname.includes('.vercel.app');
        
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
        
        console.log(`✅ Ambiente: ${isLocalhost ? 'LOCAL' : isVercel ? 'VERCEL' : 'OUTRO'}`);
        console.log(`✅ Protocol: ${env.protocol}`);
        console.log(`✅ Hostname: ${env.hostname}`);
        
        return { ...env, isVercel, isLocalhost };
    },
    
    checkWebAPIs() {
        console.log('🔌 Verificando Web APIs...');
        
        const apis = {
            AudioContext: 'AudioContext' in window,
            webkitAudioContext: 'webkitAudioContext' in window,
            FileReader: 'FileReader' in window,
            Blob: 'Blob' in window,
            fetch: 'fetch' in window,
            Promise: 'Promise' in window,
            Map: 'Map' in window,
            Set: 'Set' in window,
            WeakMap: 'WeakMap' in window,
            AbortController: 'AbortController' in window,
            performance: 'performance' in window && 'now' in performance,
            URL: 'URL' in window,
            URLSearchParams: 'URLSearchParams' in window
        };
        
        let allGood = true;
        Object.entries(apis).forEach(([api, available]) => {
            const status = available ? '✅' : '❌';
            console.log(`${status} ${api}: ${available}`);
            if (!available && ['AudioContext', 'FileReader', 'fetch', 'Promise', 'AbortController'].includes(api)) {
                allGood = false;
            }
        });
        
        // Teste específico do AudioContext
        if (apis.AudioContext || apis.webkitAudioContext) {
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                const testContext = new AudioContextClass();
                testContext.close();
                console.log('✅ AudioContext instanciável');
                apis.audioContextWorks = true;
            } catch (e) {
                console.log('❌ Erro ao instanciar AudioContext:', e.message);
                apis.audioContextWorks = false;
                allGood = false;
            }
        }
        
        console.log(`${allGood ? '✅' : '❌'} Web APIs: ${allGood ? 'COMPATÍVEL' : 'PROBLEMAS DETECTADOS'}`);
        return apis;
    },
    
    async checkScriptLoading() {
        console.log('📜 Verificando carregamento de scripts...');
        
        const scripts = {
            audioAnalyzer: typeof window.audioAnalyzer !== 'undefined',
            AudioAnalyzer: typeof window.AudioAnalyzer !== 'undefined',
            debugFase1: typeof window.debugFase1 !== 'undefined',
            RUNID_ENFORCED: typeof RUNID_ENFORCED !== 'undefined'
        };
        
        // Teste de carregamento de módulo dinâmico (importante para Vercel)
        try {
            const testModule = await import('data:text/javascript,export const test = "ok"');
            scripts.dynamicImport = testModule.test === 'ok';
            console.log('✅ Dynamic imports funcionando');
        } catch (e) {
            scripts.dynamicImport = false;
            console.log('❌ Dynamic imports com problema:', e.message);
        }
        
        Object.entries(scripts).forEach(([script, loaded]) => {
            const status = loaded ? '✅' : '❌';
            console.log(`${status} ${script}: ${loaded ? 'CARREGADO' : 'NÃO ENCONTRADO'}`);
        });
        
        return scripts;
    },
    
    checkFeatures() {
        console.log('🚀 Verificando features específicas...');
        
        const features = {};
        
        // Feature Flag
        try {
            features.featureFlag = typeof RUNID_ENFORCED !== 'undefined';
            if (features.featureFlag) {
                console.log(`✅ RUNID_ENFORCED: ${RUNID_ENFORCED}`);
            } else {
                console.log('❌ RUNID_ENFORCED não definido');
            }
        } catch (e) {
            features.featureFlag = false;
            console.log('❌ Erro ao verificar RUNID_ENFORCED:', e.message);
        }
        
        // AudioAnalyzer methods
        if (window.audioAnalyzer) {
            const analyzer = window.audioAnalyzer;
            features.analyzeAudioFile = typeof analyzer.analyzeAudioFile === 'function';
            features.generateRunId = typeof analyzer._generateRunId === 'function';
            features.logPipelineStage = typeof analyzer._logPipelineStageCompat === 'function';
            features.performFullAnalysis = typeof analyzer.performFullAnalysis === 'function';
            
            // Verificar se performFullAnalysis aceita options
            if (features.performFullAnalysis) {
                const methodStr = analyzer.performFullAnalysis.toString();
                features.performAcceptsOptions = methodStr.includes('options = {}');
                console.log(`${features.performAcceptsOptions ? '✅' : '❌'} performFullAnalysis aceita options`);
            }
            
        } else {
            console.log('❌ audioAnalyzer não disponível');
            features.analyzeAudioFile = false;
            features.generateRunId = false;
            features.logPipelineStage = false;
            features.performFullAnalysis = false;
        }
        
        return features;
    },
    
    checkPerformance() {
        console.log('⚡ Verificando performance...');
        
        const perf = {
            now: performance.now(),
            memory: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            } : null,
            timing: performance.timing ? {
                domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
                loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
            } : null
        };
        
        if (perf.memory) {
            console.log(`✅ Memória: ${perf.memory.used}MB/${perf.memory.total}MB (limite: ${perf.memory.limit}MB)`);
        } else {
            console.log('⚠️ performance.memory não disponível');
        }
        
        if (perf.timing) {
            console.log(`✅ DOM carregado em: ${perf.timing.domContentLoaded}ms`);
            console.log(`✅ Página carregada em: ${perf.timing.loadComplete}ms`);
        }
        
        return perf;
    },
    
    generateReport(results) {
        console.log('\n📊 RELATÓRIO DE COMPATIBILIDADE VERCEL');
        console.log('═══════════════════════════════════════════════════════');
        
        const criticalIssues = [];
        const warnings = [];
        
        // Verificar APIs críticas
        if (!results.webAPIs.AudioContext && !results.webAPIs.webkitAudioContext) {
            criticalIssues.push('AudioContext não disponível');
        }
        if (!results.webAPIs.audioContextWorks) {
            criticalIssues.push('AudioContext não funcional');
        }
        if (!results.webAPIs.FileReader) {
            criticalIssues.push('FileReader não disponível');
        }
        if (!results.webAPIs.fetch) {
            criticalIssues.push('Fetch API não disponível');
        }
        if (!results.webAPIs.AbortController) {
            criticalIssues.push('AbortController não disponível');
        }
        
        // Verificar scripts
        if (!results.scripts.audioAnalyzer && !results.scripts.AudioAnalyzer) {
            criticalIssues.push('AudioAnalyzer não carregado');
        }
        if (!results.scripts.RUNID_ENFORCED) {
            warnings.push('Feature flag RUNID_ENFORCED não definida');
        }
        if (!results.scripts.dynamicImport) {
            warnings.push('Dynamic imports com problemas');
        }
        
        // Verificar features
        if (!results.features.performAcceptsOptions) {
            criticalIssues.push('performFullAnalysis não aceita options');
        }
        
        // Gerar score
        const totalChecks = 20; // número aproximado de verificações críticas
        const issues = criticalIssues.length;
        const score = Math.max(0, Math.round((totalChecks - issues) / totalChecks * 100));
        
        console.log(`🎯 SCORE DE COMPATIBILIDADE: ${score}%`);
        
        if (criticalIssues.length === 0) {
            console.log('🟢 VERCEL READY: Todas as verificações críticas passaram');
        } else {
            console.log('🔴 PROBLEMAS CRÍTICOS DETECTADOS:');
            criticalIssues.forEach(issue => console.log(`   ❌ ${issue}`));
        }
        
        if (warnings.length > 0) {
            console.log('🟡 AVISOS:');
            warnings.forEach(warning => console.log(`   ⚠️ ${warning}`));
        }
        
        // Salvar globalmente para inspeção
        window.VERCEL_COMPATIBILITY_REPORT = {
            score,
            criticalIssues,
            warnings,
            fullResults: results,
            timestamp: new Date().toISOString()
        };
        
        return { score, criticalIssues, warnings };
    }
};

// Auto-executar se carregado no browser
if (typeof window !== 'undefined') {
    window.VercelCompatibilityChecker = VercelCompatibilityChecker;
    
    // Executar verificação após carregamento
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => VercelCompatibilityChecker.checkAll(), 2000);
        });
    } else {
        setTimeout(() => VercelCompatibilityChecker.checkAll(), 1000);
    }
}

console.log('🔧 VercelCompatibilityChecker carregado');
console.log('💡 Execute: VercelCompatibilityChecker.checkAll() para verificar compatibilidade');
