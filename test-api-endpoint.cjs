// 🧪 TESTE DIRETO DO ENDPOINT /api/suggestions
// Execute: node test-api-endpoint.cjs

const fetch = require('node-fetch');

async function testAPIEndpoint() {
    console.log('🔍 Testando endpoint /api/suggestions...');
    
    const mockData = {
        suggestions: [
            {
                message: "Banda low_mid ligeiramente alta para funk_mandela",
                action: "Reduzir low_mid em 27.0 dB com Q=2.0",
                priority: 7,
                confidence: 0.8
            }
        ],
        metrics: {
            lufsIntegrated: -12.5,
            truePeakDbtp: -1.2
        },
        genre: 'funk_mandela'
    };
    
    try {
        console.log('📤 Enviando request para localhost:8080/api/suggestions...');
        
        const response = await fetch('http://localhost:8080/api/suggestions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mockData)
        });
        
        console.log(`📊 Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Resposta recebida:', data);
            console.log(`🤖 Fonte: ${data.source}`);
            console.log(`📈 Sugestões: ${data.enhancedSuggestions?.length || 0}`);
        } else {
            console.error('❌ Erro na resposta:', response.statusText);
            const text = await response.text();
            console.error('📄 Conteúdo:', text);
        }
        
    } catch (error) {
        console.error('❌ Erro na requisição:', error.message);
    }
}

testAPIEndpoint();