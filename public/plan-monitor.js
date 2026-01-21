/* ============ VERIFICAÇÃO DE MUDANÇA DE PLANO (PLUS PERSONALIZAÇÃO) ============ */
// Verificar se o usuário mudou de plano durante a sessão
let currentUserPlan = null;

async function checkUserPlanStatus() {
    try {
        // Aguardar Firebase estar disponível com verificação mais robusta
        if (!window.auth || !window.db || !window.firebaseReady) {
            // Log silencioso para evitar spam
            return;
        }
        
        const user = window.auth.currentUser;
        if (!user) return;

        // Importar getDoc e doc se necessário
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        
        const userDoc = await getDoc(doc(window.db, 'usuarios', user.uid));
        const userData = userDoc.data();
        
        if (!userData) return;

        // ============ VERIFICAÇÃO DE EXPIRAÇÃO DO PLANO PLUS ============
        if (userData.planExpiresAt && userData.plano === 'plus') {
            const currentDate = new Date();
            let expirationDate;
            
            // Converter planExpiresAt para Date (compatível com diferentes formatos)
            if (userData.planExpiresAt instanceof Date) {
                expirationDate = userData.planExpiresAt;
            } else if (userData.planExpiresAt.toDate && typeof userData.planExpiresAt.toDate === 'function') {
                // Firestore Timestamp
                expirationDate = userData.planExpiresAt.toDate();
            } else if (typeof userData.planExpiresAt === 'string' || typeof userData.planExpiresAt === 'number') {
                expirationDate = new Date(userData.planExpiresAt);
            } else {
                warn('⚠️ Formato de planExpiresAt não reconhecido:', userData.planExpiresAt);
                return;
            }
            
            log('📅 Verificando expiração do plano:', {
                atual: currentDate.toISOString(),
                expira: expirationDate.toISOString(),
                expirado: expirationDate <= currentDate
            });
            
            // Se o plano já expirou, forçar atualização da página
            if (expirationDate <= currentDate) {
                log('⏰ PLANO PLUS EXPIRADO DETECTADO NO FRONTEND!');
                log('🔄 Forçando reload para atualizar status...');
                
                // Mostrar mensagem ao usuário antes do reload
                if (typeof addMessageToChat === 'function') {
                    addMessageToChat('system', '⏰ Seu plano Plus expirou. Atualizando seu acesso...');
                }
                
                // Aguardar um pouco para a mensagem aparecer
                setTimeout(() => {
                    // Forçar reload da página para que o backend processe a expiração
                    location.reload();
                }, 2000);
                
                return; // Não continuar verificação
            }
        }

        // ============ VERIFICAÇÃO DE MUDANÇA DE PLANO ============
        if (userData.plano !== currentUserPlan) {
            const previousPlan = currentUserPlan;
            currentUserPlan = userData.plano;
            
            // Se mudou de gratuito para plus, mostrar mensagem
            if (previousPlan === 'gratis' && currentUserPlan === 'plus') {
                if (typeof addMessageToChat === 'function') {
                    addMessageToChat('system', '🎉 Parabéns! Agora você tem acesso a respostas personalizadas baseadas no seu perfil técnico. As próximas respostas serão adaptadas ao seu nível e estilo musical!');
                    
                    // Se tem perfil, mostrar resumo
                    if (userData.perfil && userData.perfil.entrevistaConcluida) {
                        const perfil = userData.perfil;
                        addMessageToChat('system', `✅ Perfil detectado: ${perfil.nomeArtistico || 'Produtor'} (${perfil.nivelTecnico}, ${perfil.daw}, ${perfil.estilo}). Suas respostas agora são personalizadas!`);
                    } else {
                        addMessageToChat('system', '💡 Dica: Complete sua entrevista de perfil para respostas ainda mais personalizadas! <a href="entrevista.html" target="_blank">Clique aqui</a>');
                    }
                }
            }
            
            // Se mudou de plus para gratuito (por expiração)
            if (previousPlan === 'plus' && currentUserPlan === 'gratis') {
                if (typeof addMessageToChat === 'function') {
                    addMessageToChat('system', '⏰ Seu plano Plus expirou. Você agora tem acesso ao plano gratuito com limite de 20 mensagens mensais. <a href="planos.html" target="_blank">Renovar Plus</a>');
                }
            }
            
            log('🔄 Plano do usuário atualizado:', previousPlan, '->', currentUserPlan);
        }
    } catch (error) {
        // Log silencioso - apenas registrar sem causar alarme
        // log('⚠️ Plan monitor aguardando inicialização completa');
    }
}

// Verificar plano com intervalo otimizado para reduzir carga
function startPlanMonitoring() {
    // Verificar se estamos na página principal onde faz sentido monitorar
    const isMainPage = document.querySelector('.hero') || document.querySelector('#startSendBtn') || window.location.pathname.includes('index.html');
    
    if (isMainPage) {
        log('🔄 Iniciando monitoramento de plano otimizado...');
        // Otimizado: De 30s para 2 minutos - muito menos impacto
        setInterval(checkUserPlanStatus, 120000); // 2 minutos
        setTimeout(checkUserPlanStatus, 2000); // Verificação inicial
    } else {
        log('📄 Página secundária - pulando monitoramento de plano');
    }
}

// Inicializar quando a página carrega
document.addEventListener('DOMContentLoaded', startPlanMonitoring);
