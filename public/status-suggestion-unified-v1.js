/**
 * 🎯 SISTEMA UNIFICADO DE STATUS E SUGESTÕES V1
 * 
 * Centraliza toda lógica de determinação de status (ideal/ajustar/corrigir)
 * e geração de sugestões (aumentar/diminuir X) com base em valor, alvo e tolerância.
 * 
 * Feature Flag: STATUS_SUGGESTION_UNIFIED_V1
 * Autor: AI Synth System
 * Data: 2025-01-29
 */

// Feature Flag - Status global controlando implementação (ATIVADO AUTOMATICAMENTE)
window.STATUS_SUGGESTION_UNIFIED_V1 = window.STATUS_SUGGESTION_UNIFIED_V1 ?? true;

/**
 * 🎯 FUNÇÃO PRINCIPAL - FONTE ÚNICA DA VERDADE
 * 
 * Calcula status e sugestão baseado em valor atual, alvo e tolerância
 * 
 * @param {number} valor - Valor atual da métrica
 * @param {number} alvo - Valor alvo/ideal da métrica  
 * @param {number} tolerancia - Tolerância aceita (±)
 * @param {string} unidade - Unidade da métrica (dB, LUFS, etc.)
 * @param {string} metrica - Nome da métrica para sugestões
 * @param {Object} opcoes - Configurações opcionais
 * @returns {Object} { status, cor, sugestao, dif }
 */
function calcularStatusSugestaoUnificado(valor, alvo, tolerancia, unidade = '', metrica = '', opcoes = {}) {
    // 🛡️ GUARD RAILS MELHORADOS - Validação detalhada com logging
    if (!Number.isFinite(valor)) {
        const valorInfo = valor === null ? 'NULL' : valor === undefined ? 'UNDEFINED' : String(valor);
        console.warn(`[STATUS_UNIFIED] Valor inválido: ${valorInfo} para métrica '${metrica}' - SKIP COM GRACEFUL DEGRADATION`);
        return { 
            status: 'sem_dados', 
            cor: 'na', 
            sugestao: metrica ? `Métrica '${metrica}' não disponível` : 'Dados não disponíveis', 
            dif: NaN,
            erro: `Valor não disponível: ${valorInfo}`,
            debug: { valor, alvo, tolerancia, metrica }
        };
    }
    
    if (!Number.isFinite(alvo)) {
        const alvoInfo = alvo === null ? 'NULL' : alvo === undefined ? 'UNDEFINED' : String(alvo);
        console.warn(`[STATUS_UNIFIED] Alvo inválido: ${alvoInfo} para métrica '${metrica}' - SKIP COM GRACEFUL DEGRADATION`);
        return { 
            status: 'sem_alvo', 
            cor: 'na', 
            sugestao: metrica ? `Referência para '${metrica}' não disponível` : 'Referência não disponível', 
            dif: NaN,
            erro: `Alvo não disponível: ${alvoInfo}`,
            debug: { valor, alvo, tolerancia, metrica }
        };
    }
    
    if (!Number.isFinite(tolerancia) || tolerancia <= 0) {
        console.warn(`[STATUS_UNIFIED] Tolerância inválida: ${tolerancia} para métrica '${metrica}' - USANDO TOLERÂNCIA PADRÃO`);
        tolerancia = Math.abs(alvo) * 0.1; // 10% do valor do alvo como tolerância padrão
        console.log(`[STATUS_UNIFIED] Tolerância padrão aplicada: ${tolerancia.toFixed(3)} para '${metrica}'`);
    }
    
    // 📊 Cálculo da diferença
    const dif = valor - alvo;
    const absDif = Math.abs(dif);
    
    // 🎯 Lógica Linear de Tolerância
    // Zona IDEAL: |diferença| <= tolerância
    // Zona AJUSTAR: tolerância < |diferença| <= 2 * tolerância  
    // Zona CORRIGIR: |diferença| > 2 * tolerância
    
    let status, cor, sugestao;
    
    if (absDif <= tolerancia) {
        // ✅ ZONA IDEAL
        status = 'ideal';
        cor = 'ok';  // Verde/OK
        sugestao = null; // NUNCA gera sugestão se ideal
        
    } else {
        const multiplicador = absDif / tolerancia;
        
        if (multiplicador <= 2) {
            // ⚠️ ZONA AJUSTAR
            status = 'ajustar';
            cor = 'yellow'; // Amarelo/Warning
            
            // Gerar sugestão específica
            const direcao = dif > 0 ? 'diminuir' : 'aumentar';
            const quantidade = Math.abs(dif).toFixed(2);
            
            sugestao = {
                direcao,
                quantidade: `${quantidade}${unidade}`,
                alvo: `${alvo}${unidade}`,
                texto: `${direcao.charAt(0).toUpperCase() + direcao.slice(1)} ${metrica} em ${quantidade}${unidade} para atingir ${alvo}${unidade}`
            };
            
        } else {
            // 🚨 ZONA CORRIGIR  
            status = 'corrigir';
            cor = 'warn'; // Vermelho/Error
            
            // Gerar sugestão urgente
            const direcao = dif > 0 ? 'reduzir significativamente' : 'elevar significativamente';
            const quantidade = Math.abs(dif).toFixed(2);
            
            sugestao = {
                direcao: dif > 0 ? 'diminuir' : 'aumentar',
                quantidade: `${quantidade}${unidade}`,
                alvo: `${alvo}${unidade}`,
                urgencia: true,
                texto: `${direcao.charAt(0).toUpperCase() + direcao.slice(1)} ${metrica} em ${quantidade}${unidade} para atingir ${alvo}${unidade}`
            };
        }
    }
    
    // 📝 Log para debugging (apenas se debug ativo)
    if (opcoes.debug) {
        console.log(`[STATUS_UNIFIED] ${metrica}: ${valor}${unidade} -> ${status} (dif: ${dif.toFixed(2)}${unidade}, tol: ±${tolerancia}${unidade})`);
    }
    
    return {
        status,     // 'ideal' | 'ajustar' | 'corrigir'
        cor,        // 'ok' | 'yellow' | 'warn'  
        sugestao,   // null | { direcao, quantidade, alvo, texto, urgencia? }
        dif         // Diferença calculada (valor - alvo)
    };
}

/**
 * 🎨 GERADOR DE CSS CLASS UNIFICADO
 * 
 * Mapeia status para classes CSS consistentes
 */
function obterClasseCssStatus(status) {
    const mapa = {
        'ideal': 'ok',
        'ajustar': 'yellow', 
        'corrigir': 'warn',
        'indefinido': 'na'
    };
    
    return mapa[status] || 'na';
}

/**
 * 🎭 GERADOR DE ÍCONES E TEXTOS VISUAIS
 * 
 * Padroniza apresentação visual dos status
 */
function obterVisualizacaoStatus(status) {
    const visualizacoes = {
        'ideal': {
            icone: '✅',
            texto: 'IDEAL',
            emoji: '🎯',
            descricao: 'Dentro da faixa ideal'
        },
        'ajustar': {
            icone: '⚠️', 
            texto: 'AJUSTAR',
            emoji: '🔧',
            descricao: 'Requer ajuste leve'
        },
        'corrigir': {
            icone: '🚨',
            texto: 'CORRIGIR', 
            emoji: '⚡',
            descricao: 'Requer correção urgente'
        },
        'indefinido': {
            icone: '❓',
            texto: 'N/A',
            emoji: '🤷',
            descricao: 'Dados insuficientes'
        }
    };
    
    return visualizacoes[status] || visualizacoes['indefinido'];
}

/**
 * 🔧 HELPER: Formatação de sugestão para UI
 * 
 * Converte objeto sugestão em texto legível
 */
function formatarSugestaoTexto(sugestao) {
    if (!sugestao) return '';
    
    const simbolo = sugestao.direcao === 'aumentar' ? '↑' : '↓';
    const intensidade = sugestao.urgencia ? '↑↑' : simbolo;
    
    return `${intensidade} ${sugestao.texto}`;
}

/**
 * 🏗️ BUILDER DE CÉLULA DE TABELA UNIFICADA
 * 
 * Substitui createEnhancedDiffCell com sistema unificado
 */
function criarCelulaDiferenca(valor, alvo, tolerancia, unidade = '', metrica = '') {
    if (!window.STATUS_SUGGESTION_UNIFIED_V1) {
        // Fallback para sistema legacy
        console.warn('[STATUS_UNIFIED] Feature flag desabilitada, usando sistema legacy');
        return null;
    }
    
    const resultado = calcularStatusSugestaoUnificado(valor, alvo, tolerancia, unidade, metrica);
    const visual = obterVisualizacaoStatus(resultado.status);
    const sugestaoTexto = formatarSugestaoTexto(resultado.sugestao);
    
    const difFormatada = Number.isFinite(resultado.dif) 
        ? `${resultado.dif > 0 ? '+' : ''}${resultado.dif.toFixed(2)}${unidade}`
        : '—';
    
    return `<td class="${resultado.cor}">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="font-size: 12px; font-weight: 600;">${difFormatada}</div>
            <div style="font-size: 10px; opacity: 0.8;">${visual.icone} ${visual.texto}</div>
            ${sugestaoTexto ? `<div style="font-size: 9px; color: #666;">${sugestaoTexto}</div>` : ''}
        </div>
    </td>`;
}

/**
 * 📊 CONTADOR DE PROBLEMAS UNIFICADO
 * 
 * Conta quantos valores estão fora do ideal baseado no sistema unificado
 */
function contarProblemasUnificado(metricas) {
    if (!window.STATUS_SUGGESTION_UNIFIED_V1) return { total: 0, detalhes: [] };
    
    let problemas = 0;
    const detalhes = [];
    
    for (const metrica of metricas) {
        const { valor, alvo, tolerancia, nome } = metrica;
        const resultado = calcularStatusSugestaoUnificado(valor, alvo, tolerancia);
        
        if (resultado.status !== 'ideal') {
            problemas++;
            detalhes.push({
                nome,
                status: resultado.status,
                diferenca: resultado.dif,
                sugestao: resultado.sugestao
            });
        }
    }
    
    return { total: problemas, detalhes };
}

/**
 * 🧪 TESTES UNITÁRIOS INTEGRADOS
 * 
 * Validação automática da lógica unificada
 */
function executarTestesUnificados() {
    console.log('[STATUS_UNIFIED] Executando testes unitários...');
    
    const testes = [
        // Teste IDEAL
        {
            nome: 'Valor ideal',
            entrada: { valor: -14.0, alvo: -14, tolerancia: 1 },
            esperado: { status: 'ideal', cor: 'ok', temSugestao: false }
        },
        // Teste AJUSTAR
        {
            nome: 'Ajuste leve',
            entrada: { valor: -15.5, alvo: -14, tolerancia: 1 },
            esperado: { status: 'ajustar', cor: 'yellow', temSugestao: true }
        },
        // Teste CORRIGIR
        {
            nome: 'Correção urgente',
            entrada: { valor: -17.0, alvo: -14, tolerancia: 1 },
            esperado: { status: 'corrigir', cor: 'warn', temSugestao: true }
        },
        // Teste limites exatos
        {
            nome: 'Limite tolerância',
            entrada: { valor: -15.0, alvo: -14, tolerancia: 1 },
            esperado: { status: 'ideal', cor: 'ok', temSugestao: false }
        },
        {
            nome: 'Limite 2x tolerância',
            entrada: { valor: -16.0, alvo: -14, tolerancia: 1 },
            esperado: { status: 'ajustar', cor: 'yellow', temSugestao: true }
        }
    ];
    
    let passou = 0;
    let falhou = 0;
    
    for (const teste of testes) {
        const { valor, alvo, tolerancia } = teste.entrada;
        const resultado = calcularStatusSugestaoUnificado(valor, alvo, tolerancia);
        
        const statusOk = resultado.status === teste.esperado.status;
        const corOk = resultado.cor === teste.esperado.cor;
        const sugestaoOk = (resultado.sugestao !== null) === teste.esperado.temSugestao;
        
        if (statusOk && corOk && sugestaoOk) {
            passou++;
            console.log(`✅ ${teste.nome}: PASSOU`);
        } else {
            falhou++;
            console.error(`❌ ${teste.nome}: FALHOU`, {
                esperado: teste.esperado,
                obtido: { 
                    status: resultado.status, 
                    cor: resultado.cor, 
                    temSugestao: resultado.sugestao !== null 
                }
            });
        }
    }
    
    console.log(`[STATUS_UNIFIED] Testes finalizados: ${passou} passou, ${falhou} falhou`);
    return { passou, falhou, total: testes.length };
}

// 🚀 INICIALIZAÇÃO E EXPORTAÇÃO
if (typeof window !== 'undefined') {
    // Disponibilizar no escopo global
    window.calcularStatusSugestaoUnificado = calcularStatusSugestaoUnificado;
    window.criarCelulaDiferenca = criarCelulaDiferenca;
    window.contarProblemasUnificado = contarProblemasUnificado;
    window.obterClasseCssStatus = obterClasseCssStatus;
    window.obterVisualizacaoStatus = obterVisualizacaoStatus;
    window.formatarSugestaoTexto = formatarSugestaoTexto;
    window.executarTestesUnificados = executarTestesUnificados;
    
    // Auto-testes se debug ativo
    if (window.STATUS_SUGGESTION_UNIFIED_V1 && window.location.search.includes('debug=unified')) {
        setTimeout(() => executarTestesUnificados(), 100);
    }
    
    console.log('[STATUS_UNIFIED] Sistema unificado carregado. Feature flag:', window.STATUS_SUGGESTION_UNIFIED_V1);
}

// Exportação para Node.js/módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calcularStatusSugestaoUnificado,
        criarCelulaDiferenca,
        contarProblemasUnificado,
        obterClasseCssStatus,
        obterVisualizacaoStatus,
        formatarSugestaoTexto,
        executarTestesUnificados
    };
}
