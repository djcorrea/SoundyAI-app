// 🧪 SCRIPT DE VALIDAÇÃO: Sistema de Caps de dB + Tradução Educativa
// Executa testes básicos das funções implementadas

console.log('🎚️ Iniciando validação do sistema de caps...');

// Simular dados necessários para teste (compatível Node.js e browser)
const globalContext = typeof window !== 'undefined' ? window : globalThis;
globalContext.PROD_AI_REF_GENRE = 'funk';

// Classe de teste que simula o EnhancedSuggestionEngine
class TestEnhancedSuggestionEngine {
    constructor() {
        this.auditLog = [];
    }

    logAudit(type, message, data = {}) {
        this.auditLog.push({
            timestamp: Date.now(),
            type,
            message,
            data
        });
        console.log(`[${type}] ${message}`, data);
    }

    // 🎚️ SISTEMA DE CAPS MUSICAIS POR BANDA (copiado da implementação)
    clampDeltaByBand(bandName, rawDelta) {
        const caps = {
            'sub': 5.0,           
            'bass': 4.5,          
            'low_bass': 4.5,      
            'upper_bass': 4.0,    
            'lowMid': 3.5,        
            'low_mid': 3.5,       
            'mid': 3.0,           
            'highMid': 2.5,       
            'high_mid': 2.5,      
            'presenca': 2.5,      
            'presence': 2.5,      
            'brilho': 2.0,        
            'air': 2.0            
        };

        const cap = caps[bandName] || 3.0;
        const clampedDelta = Math.max(-cap, Math.min(cap, rawDelta));
        
        this.logAudit('DELTA_CLAMPED', `Delta clamped para banda ${bandName}`, {
            bandName,
            rawDelta: rawDelta.toFixed(2),
            cap: cap.toFixed(1),
            clampedDelta: clampedDelta.toFixed(2),
            wasClamped: Math.abs(rawDelta) > cap
        });
        
        return clampedDelta;
    }

    // ✍️ TRADUÇÃO MUSICAL EDUCATIVA (copiado da implementação)
    generateEducationalMessage(bandName, clampedDelta) {
        const absValue = Math.abs(clampedDelta);
        const direction = clampedDelta > 0 ? 'increase' : 'decrease';
        
        const educationalTemplates = {
            'sub': {
                increase: `Experimente Aumentar ~${absValue.toFixed(1)} dB p/ dar peso`,
                decrease: `Experimente Reduzir ~${absValue.toFixed(1)} dB p/ controlar sub`
            },
            'bass': {
                increase: `Realce entre +${absValue.toFixed(1)} dB p/ mais impacto`,
                decrease: `Reduza entre -${absValue.toFixed(1)} dB p/ equilibrar`
            },
            'low_bass': {
                increase: `Realce entre +${absValue.toFixed(1)} dB p/ mais impacto`,
                decrease: `Reduza entre -${absValue.toFixed(1)} dB p/ equilibrar`
            },
            'upper_bass': {
                increase: `Experimente Aumentar +${absValue.toFixed(1)} dB p/ corpo`,
                decrease: `Experimente Reduzir -${absValue.toFixed(1)} dB p/ clarear`
            },
            'lowMid': {
                increase: `Experimente Aumentar +${absValue.toFixed(1)} dB p/ aquecer mix`,
                decrease: `Experimente Reduzir ~${absValue.toFixed(1)} dB p/ limpar mix`
            },
            'low_mid': {
                increase: `Experimente Aumentar +${absValue.toFixed(1)} dB p/ aquecer mix`,
                decrease: `Experimente Reduzir ~${absValue.toFixed(1)} dB p/ limpar mix`
            },
            'mid': {
                increase: `Experimente Aumentar +${absValue.toFixed(1)} dB p/ presença`,
                decrease: `Experimente Reduzir -${absValue.toFixed(1)} a -${(absValue + 1).toFixed(1)} dB p/ clarear`
            },
            'highMid': {
                increase: `Experimente Aumentar +${absValue.toFixed(1)} dB p/ ataque`,
                decrease: `Experimente Reduzir ~${absValue.toFixed(1)} dB p/ suavizar`
            },
            'high_mid': {
                increase: `Experimente Aumentar +${absValue.toFixed(1)} dB p/ ataque`,
                decrease: `Experimente Reduzir ~${absValue.toFixed(1)} dB p/ suavizar`
            },
            'presenca': {
                increase: `Experimente Aumentar +${absValue.toFixed(1)} dB p/ destacar voz`,
                decrease: `Experimente Reduzir ~${absValue.toFixed(1)} dB p/ suavizar voz`
            },
            'presence': {
                increase: `Experimente Aumentar +${absValue.toFixed(1)} dB p/ destacar voz`,
                decrease: `Experimente Reduzir ~${absValue.toFixed(1)} dB p/ suavizar voz`
            },
            'brilho': {
                increase: `Experimente Adicionar +${absValue.toFixed(1)} dB p/ brilho`,
                decrease: `Experimente Reduzir ~${absValue.toFixed(1)} dB p/ menos aspereza`
            },
            'air': {
                increase: `Experimente Adicionar +${absValue.toFixed(1)} dB p/ brilho`,
                decrease: `Experimente Reduzir ~${absValue.toFixed(1)} dB p/ menos aspereza`
            }
        };

        const template = educationalTemplates[bandName];
        if (template && template[direction]) {
            return template[direction];
        }

        const verb = direction === 'increase' ? 'Aumentar' : 'Reduzir';
        const sign = direction === 'increase' ? '+' : '-';
        return `Experimente ${verb} ${sign}${absValue.toFixed(1)} dB na banda ${bandName}`;
    }
}

// 🧪 Executar testes
function runValidationTests() {
    const engine = new TestEnhancedSuggestionEngine();
    
    console.log('\n🧪 === TESTES DE VALIDAÇÃO ===');
    
    // Casos de teste
    const testCases = [
        { band: 'sub', delta: 12.5, expectedCap: 5.0 },
        { band: 'bass', delta: 3.2, expectedCap: 4.5 },
        { band: 'mid', delta: -8.7, expectedCap: 3.0 },
        { band: 'highMid', delta: 1.8, expectedCap: 2.5 },
        { band: 'presenca', delta: 15.3, expectedCap: 2.5 },
        { band: 'brilho', delta: -1.2, expectedCap: 2.0 },
        { band: 'unknown_band', delta: 6.8, expectedCap: 3.0 }
    ];
    
    let passedTests = 0;
    
    testCases.forEach((test, index) => {
        console.log(`\n🔸 Teste ${index + 1}: ${test.band} (delta: ${test.delta})`);
        
        try {
            // Testar clamp
            const clampedDelta = engine.clampDeltaByBand(test.band, test.delta);
            const expectedClampedValue = test.delta > 0 ? 
                Math.min(test.delta, test.expectedCap) :
                Math.max(test.delta, -test.expectedCap);
            
            const clampCorrect = Math.abs(clampedDelta - expectedClampedValue) < 0.01;
            
            // Testar mensagem educativa
            const educationalMessage = engine.generateEducationalMessage(test.band, clampedDelta);
            
            console.log(`   Raw: ${test.delta} → Clamped: ${clampedDelta} (esperado: ${expectedClampedValue})`);
            console.log(`   Mensagem: "${educationalMessage}"`);
            console.log(`   Status: ${clampCorrect ? '✅ PASSOU' : '❌ FALHOU'}`);
            
            if (clampCorrect) passedTests++;
            
        } catch (error) {
            console.log(`   ❌ ERRO: ${error.message}`);
        }
    });
    
    console.log(`\n📊 Resultado: ${passedTests}/${testCases.length} testes passaram`);
    
    if (passedTests === testCases.length) {
        console.log('🎉 TODOS OS TESTES PASSARAM! Sistema funcionando corretamente.');
    } else {
        console.log('⚠️ Alguns testes falharam. Verificar implementação.');
    }
    
    // Teste adicional: verificar mensagens educativas
    console.log('\n🎵 === TESTE DAS MENSAGENS EDUCATIVAS ===');
    ['sub', 'bass', 'mid', 'presenca', 'brilho'].forEach(band => {
        const positiveDelta = 2.0;
        const negativeDelta = -2.0;
        
        const positiveMessage = engine.generateEducationalMessage(band, positiveDelta);
        const negativeMessage = engine.generateEducationalMessage(band, negativeDelta);
        
        console.log(`${band}:`);
        console.log(`  Positivo: "${positiveMessage}"`);
        console.log(`  Negativo: "${negativeMessage}"`);
    });
    
    console.log('\n✅ Validação concluída!');
}

// Executar testes quando script for carregado
if (typeof window !== 'undefined') {
    // No browser
    window.addEventListener('load', () => {
        setTimeout(runValidationTests, 500);
    });
} else {
    // No Node.js
    runValidationTests();
}

// Exportar para uso externo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TestEnhancedSuggestionEngine, runValidationTests };
}