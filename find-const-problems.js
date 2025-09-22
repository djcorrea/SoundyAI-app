// Script para localizar exatamente onde está o erro de "Assignment to const variable"

import fs from 'fs';

console.log('🔍 Analisando enhanced-suggestion-engine.js para problemas de const...');

try {
    const content = fs.readFileSync('./public/enhanced-suggestion-engine.js', 'utf8');
    const lines = content.split('\n');
    
    let potentialProblems = [];
    let inFunction = false;
    let functionName = '';
    let currentFunction = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        // Detectar início de função
        if (line.includes('generateReferenceSuggestions') || line.includes('postProcessBandSuggestions')) {
            inFunction = true;
            functionName = line.includes('generateReferenceSuggestions') ? 'generateReferenceSuggestions' : 'postProcessBandSuggestions';
            currentFunction = functionName;
        }
        
        // Detectar final de função (fechamento de chave no nível da função)
        if (inFunction && line.trim() === '}' && !line.includes('if') && !line.includes('for') && !line.includes('while')) {
            inFunction = false;
            functionName = '';
        }
        
        if (inFunction) {
            // Procurar por declarações const
            if (line.includes('const ') && (line.includes('action') || line.includes('delta') || line.includes('diagnosis'))) {
                const constVar = line.match(/const\s+(\w+)/);
                if (constVar) {
                    const varName = constVar[1];
                    
                    // Procurar por possíveis reatribuições nas próximas linhas
                    for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
                        const nextLine = lines[j];
                        if (nextLine.includes(`${varName} =`) && !nextLine.includes('const') && !nextLine.includes('let')) {
                            potentialProblems.push({
                                function: currentFunction,
                                constDeclaration: lineNum,
                                constLine: line.trim(),
                                reassignmentLine: j + 1,
                                reassignmentCode: nextLine.trim(),
                                variable: varName
                            });
                        }
                    }
                }
            }
            
            // Procurar por padrões problemáticos específicos
            if (line.includes('action =') && !line.includes('const') && !line.includes('let')) {
                potentialProblems.push({
                    function: currentFunction,
                    type: 'direct_assignment',
                    line: lineNum,
                    code: line.trim(),
                    variable: 'action'
                });
            }
            
            if (line.includes('delta =') && !line.includes('const') && !line.includes('let')) {
                potentialProblems.push({
                    function: currentFunction,
                    type: 'direct_assignment', 
                    line: lineNum,
                    code: line.trim(),
                    variable: 'delta'
                });
            }
            
            if (line.includes('diagnosis =') && !line.includes('const') && !line.includes('let')) {
                potentialProblems.push({
                    function: currentFunction,
                    type: 'direct_assignment',
                    line: lineNum, 
                    code: line.trim(),
                    variable: 'diagnosis'
                });
            }
        }
    }
    
    console.log(`📊 Análise completa. Encontrados ${potentialProblems.length} problemas potenciais:`);
    
    if (potentialProblems.length === 0) {
        console.log('✅ Nenhum problema de reatribuição de const detectado!');
        console.log('O erro pode estar em outra parte do código ou em uma condição específica.');
    } else {
        potentialProblems.forEach((problem, index) => {
            console.log(`\n❌ Problema ${index + 1}:`);
            console.log(`   Função: ${problem.function}`);
            if (problem.type === 'direct_assignment') {
                console.log(`   Tipo: Atribuição direta`);
                console.log(`   Linha ${problem.line}: ${problem.code}`);
                console.log(`   Variável: ${problem.variable}`);
            } else {
                console.log(`   Declaração const na linha ${problem.constDeclaration}: ${problem.constLine}`);
                console.log(`   Reatribuição na linha ${problem.reassignmentLine}: ${problem.reassignmentCode}`);
                console.log(`   Variável: ${problem.variable}`);
            }
        });
        
        console.log('\n🔧 Soluções recomendadas:');
        console.log('1. Trocar "const" por "let" para variáveis que precisam ser reatribuídas');
        console.log('2. Verificar se não há tentativas de modificar propriedades de objetos const');
        console.log('3. Usar destructuring ou spread operator para criar novos objetos');
    }
    
} catch (error) {
    console.error('❌ Erro ao analisar arquivo:', error.message);
}

console.log('\n🎯 Análise concluída.');