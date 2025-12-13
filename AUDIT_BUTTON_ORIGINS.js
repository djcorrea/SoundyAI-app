// 🔍 AUDITORIA COMPLETA - DESCOBRIR ORIGEM DOS DISPAROS
// Cole este código no console do navegador e clique nos botões

(function() {
    'use strict';
    
    console.clear();
    console.log('%c🔍 AUDITORIA INICIADA', 'color: #4a90e2; font-size: 18px; font-weight: bold');
    console.log('Aguarde 2 segundos para instrumentação...\n');
    
    // ========================================
    // 1️⃣ IDENTIFICAR ELEMENTOS REAIS
    // ========================================
    
    setTimeout(() => {
        console.group('1️⃣ IDENTIFICAÇÃO DE ELEMENTOS');
        
        // Buscar botões por diferentes critérios
        const selectors = [
            'button[onclick*="sendModalAnalysisToChat"]',
            'button[onclick*="downloadModalAnalysis"]',
            'button.action-btn.primary',
            'button.action-btn.secondary',
            'button:contains("Pedir Ajuda à IA")',
            'button:contains("Baixar Relatório")'
        ];
        
        const buttons = [];
        
        selectors.forEach(sel => {
            try {
                const elements = document.querySelectorAll(sel);
                elements.forEach(el => {
                    if (!buttons.includes(el)) {
                        buttons.push(el);
                    }
                });
            } catch (e) {}
        });
        
        // Também buscar por texto
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim();
            if (text.includes('Pedir Ajuda à IA') || text.includes('Baixar Relatório')) {
                if (!buttons.includes(btn)) {
                    buttons.push(btn);
                }
            }
        });
        
        console.log(`📊 Total de botões encontrados: ${buttons.length}\n`);
        
        buttons.forEach((btn, index) => {
            console.group(`Botão ${index + 1}: ${btn.textContent.trim()}`);
            
            // Informações básicas
            console.log('📍 outerHTML:', btn.outerHTML);
            console.log('🆔 id:', btn.id || '(sem id)');
            console.log('📦 className:', btn.className || '(sem classes)');
            console.log('🔤 type:', btn.type);
            console.log('📐 tagName:', btn.tagName);
            
            // CSS e eventos
            const computed = getComputedStyle(btn);
            console.log('👆 pointerEvents:', computed.pointerEvents);
            console.log('👁️ visibility:', computed.visibility);
            console.log('🎨 display:', computed.display);
            console.log('📏 opacity:', computed.opacity);
            
            // Contexto
            const form = btn.closest('form');
            console.log('📋 dentro de <form>:', !!form);
            if (form) {
                console.log('   form.action:', form.action);
                console.log('   form.method:', form.method);
            }
            
            // Parent
            console.log('👨 parent:', btn.parentElement?.tagName, btn.parentElement?.className);
            
            console.groupEnd();
        });
        
        console.groupEnd();
        
        // Armazenar globalmente para próximas etapas
        window.__AUDIT_BUTTONS__ = buttons;
        
        // ========================================
        // 2️⃣ DETECTAR HANDLERS INLINE
        // ========================================
        
        console.group('2️⃣ HANDLERS INLINE');
        
        buttons.forEach((btn, index) => {
            console.group(`Botão ${index + 1}: ${btn.textContent.trim()}`);
            
            // onclick atributo
            const onclickAttr = btn.getAttribute('onclick');
            console.log('📜 getAttribute("onclick"):', onclickAttr || '(nenhum)');
            
            // onclick propriedade
            const onclickProp = btn.onclick;
            console.log('⚙️ btn.onclick:', onclickProp ? onclickProp.toString() : '(null)');
            
            // Outros handlers inline
            const inlineHandlers = [
                'onmousedown', 'onmouseup', 'onpointerdown', 'onpointerup',
                'ontouchstart', 'ontouchend', 'onkeydown', 'onkeyup',
                'onsubmit', 'onfocus', 'onblur'
            ];
            
            const foundHandlers = [];
            inlineHandlers.forEach(handler => {
                if (btn[handler]) {
                    foundHandlers.push(handler);
                }
            });
            
            if (foundHandlers.length > 0) {
                console.log('⚡ Outros handlers inline:', foundHandlers.join(', '));
                foundHandlers.forEach(h => {
                    console.log(`   ${h}:`, btn[h].toString());
                });
            } else {
                console.log('⚡ Outros handlers inline: (nenhum)');
            }
            
            console.groupEnd();
        });
        
        console.groupEnd();
        
        // ========================================
        // 3️⃣ EVENT TRAP - DESCOBRIR LISTENERS
        // ========================================
        
        console.group('3️⃣ EVENT TRAP - Monitoramento de Eventos');
        console.log('⚠️ Instalando traps... Aguarde e CLIQUE nos botões agora!\n');
        
        const eventTypes = [
            'click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup',
            'touchstart', 'touchend', 'keydown', 'keyup', 'submit'
        ];
        
        // Trap no document (capturing)
        eventTypes.forEach(eventType => {
            document.addEventListener(eventType, (e) => {
                buttons.forEach((btn, index) => {
                    if (e.target === btn || btn.contains(e.target)) {
                        console.log(`%c🎯 EVENTO CAPTURADO (document capturing)`, 'color: #e74c3c; font-weight: bold');
                        console.log(`   Tipo: ${e.type}`);
                        console.log(`   Target: ${e.target.textContent?.trim()}`);
                        console.log(`   CurrentTarget: ${e.currentTarget.constructor.name}`);
                        console.log(`   Fase: CAPTURING (true)`);
                        console.log(`   Path:`, e.composedPath().map(el => el.tagName || el.constructor.name));
                        console.log(`   Timestamp:`, new Date().toLocaleTimeString());
                        console.trace('Stack trace:');
                    }
                });
            }, true); // capturing
        });
        
        // Trap direto nos botões (bubbling)
        buttons.forEach((btn, index) => {
            eventTypes.forEach(eventType => {
                btn.addEventListener(eventType, (e) => {
                    console.log(`%c🔵 EVENTO NO BOTÃO (bubbling)`, 'color: #3498db; font-weight: bold');
                    console.log(`   Botão: ${btn.textContent.trim()}`);
                    console.log(`   Tipo: ${e.type}`);
                    console.log(`   Target: ${e.target.textContent?.trim()}`);
                    console.log(`   CurrentTarget: ${e.currentTarget.textContent?.trim()}`);
                    console.log(`   Fase: BUBBLING (false)`);
                    console.log(`   Timestamp:`, new Date().toLocaleTimeString());
                    console.trace('Stack trace:');
                }, false); // bubbling
            });
        });
        
        console.log('✅ Event traps instalados! CLIQUE nos botões agora.\n');
        console.groupEnd();
        
        // ========================================
        // 4️⃣ INSTRUMENTAR FUNÇÕES CRÍTICAS
        // ========================================
        
        console.group('4️⃣ INSTRUMENTAÇÃO DE FUNÇÕES');
        
        // Lista de funções para instrumentar
        const functionsToInstrument = [
            'sendModalAnalysisToChat',
            'downloadModalAnalysis',
            'generatePDF',
            'generateDetailedReport',
            'startPdfGeneration',
            'createPDF',
            'exportPDF'
        ];
        
        functionsToInstrument.forEach(fnName => {
            if (typeof window[fnName] === 'function') {
                const original = window[fnName];
                
                window[fnName] = function(...args) {
                    console.log(`%c🔴 FUNÇÃO EXECUTADA: ${fnName}`, 'color: #e74c3c; font-size: 14px; font-weight: bold');
                    console.log(`   Argumentos:`, args);
                    console.log(`   APP_MODE:`, window.APP_MODE);
                    console.trace(`   Stack trace de ${fnName}:`);
                    
                    return original.apply(this, args);
                };
                
                console.log(`✅ Instrumentado: ${fnName}`);
            } else {
                console.log(`⚠️ Não encontrado: ${fnName}`);
            }
        });
        
        console.groupEnd();
        
        // ========================================
        // 5️⃣ BUSCAR EVENT DELEGATION
        // ========================================
        
        console.group('5️⃣ BUSCA DE EVENT DELEGATION');
        console.log('Buscando listeners globais que possam estar delegando eventos...\n');
        
        // Tentar acessar listeners (Chrome DevTools Protocol)
        if (typeof getEventListeners === 'function') {
            console.log('📊 Listeners no document:');
            const docListeners = getEventListeners(document);
            Object.keys(docListeners).forEach(eventType => {
                if (docListeners[eventType].length > 0) {
                    console.log(`   ${eventType}: ${docListeners[eventType].length} listener(s)`);
                    docListeners[eventType].forEach((listener, i) => {
                        console.log(`      ${i + 1}.`, listener.listener.toString().substring(0, 200));
                    });
                }
            });
            
            console.log('\n📊 Listeners nos botões:');
            buttons.forEach((btn, index) => {
                const btnListeners = getEventListeners(btn);
                const hasListeners = Object.keys(btnListeners).some(k => btnListeners[k].length > 0);
                if (hasListeners) {
                    console.log(`   Botão ${index + 1}: ${btn.textContent.trim()}`);
                    Object.keys(btnListeners).forEach(eventType => {
                        if (btnListeners[eventType].length > 0) {
                            console.log(`      ${eventType}: ${btnListeners[eventType].length} listener(s)`);
                        }
                    });
                }
            });
        } else {
            console.log('⚠️ getEventListeners não disponível (não é Chrome DevTools)');
            console.log('   Use Chrome DevTools para ver listeners');
        }
        
        console.groupEnd();
        
        // ========================================
        // 6️⃣ ANÁLISE DO CÓDIGO FONTE
        // ========================================
        
        console.group('6️⃣ ANÁLISE DO CÓDIGO FONTE');
        console.log('Buscando referências no código carregado...\n');
        
        const searchTerms = [
            'sendModalAnalysisToChat',
            'downloadModalAnalysis',
            'generatePDF',
            'addEventListener.*click',
            'Pedir Ajuda à IA',
            'Baixar Relatório'
        ];
        
        console.log('🔍 Termos de busca:', searchTerms);
        console.log('⚠️ Abra o DevTools > Sources e busque manualmente por estes termos\n');
        console.log('📋 Scripts carregados na página:');
        
        Array.from(document.querySelectorAll('script[src]')).forEach((script, i) => {
            console.log(`   ${i + 1}. ${script.src}`);
        });
        
        console.groupEnd();
        
        // ========================================
        // 📊 RESUMO E PRÓXIMOS PASSOS
        // ========================================
        
        console.log('\n');
        console.log('%c📊 AUDITORIA CONFIGURADA', 'color: #2ecc71; font-size: 18px; font-weight: bold');
        console.log('%c⚠️ AGORA CLIQUE NOS BOTÕES:', 'color: #f39c12; font-size: 16px; font-weight: bold');
        console.log('   1. "Pedir Ajuda à IA"');
        console.log('   2. "Baixar Relatório"');
        console.log('\n📋 Observe os logs que aparecerão:');
        console.log('   - 🎯 Eventos capturados');
        console.log('   - 🔵 Eventos nos botões');
        console.log('   - 🔴 Funções executadas');
        console.log('\n💡 Depois de clicar, copie TODOS os logs e me envie.');
        
    }, 2000);
    
})();
