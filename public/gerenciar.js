// Sistema Centralizado de Logs - Importado automaticamente
import { log, warn, error, info, debug } from './logger.js';

// gerenciar.js - Script para gerenciamento de conta
import { auth } from './firebase.js';
import { updatePassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';

// Aguardar DOM estar carregado
document.addEventListener('DOMContentLoaded', function() {
    log('🔧 Gerenciar.js carregado');
    
    // Elementos do DOM
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const updatePasswordBtn = document.getElementById('update-password-btn');
    const backToChatBtn = document.getElementById('back-to-chat-simple');
    
    // Verificar se o usuário está autenticado
    let currentUser = null;
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            log('✅ Usuário autenticado:', user.email);
            
            // ============ VERIFICAÇÃO DE EXPIRAÇÃO DO PLANO PLUS ============
            await checkPlanExpiration(user);
            
        } else {
            log('❌ Usuário não autenticado - redirecionando...');
            window.location.href = 'login.html';
        }
    });
    
    // Função para verificar expiração do plano Plus
    async function checkPlanExpiration(user) {
        try {
            // Aguardar Firebase Firestore estar disponível
            if (!window.db) {
                log('⚠️ Firestore não disponível ainda - pulando verificação');
                return;
            }
            
            // Importar getDoc e doc
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
            
            const userDoc = await getDoc(doc(window.db, 'usuarios', user.uid));
            
            if (!userDoc.exists()) {
                log('⚠️ Dados do usuário não encontrados no Firestore');
                return;
            }
            
            const userData = userDoc.data();
            
            // Verificar se tem plano Plus com data de expiração
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
                
                log('📅 Verificando expiração do plano na página de gerenciamento:', {
                    atual: currentDate.toISOString(),
                    expira: expirationDate.toISOString(),
                    expirado: expirationDate <= currentDate
                });
                
                // Se o plano já expirou, mostrar aviso e forçar logout + reload
                if (expirationDate <= currentDate) {
                    log('⏰ PLANO PLUS EXPIRADO DETECTADO NA PÁGINA DE GERENCIAMENTO!');
                    
                    // Mostrar mensagem de expiração
                    showMessage('⏰ Seu plano Plus expirou. Redirecionando para atualizar seu acesso...', 'warning');
                    
                    // Aguardar um pouco para mostrar a mensagem
                    setTimeout(async () => {
                        try {
                            // Fazer logout para forçar reautenticação
                            await auth.signOut();
                            log('🔓 Logout forçado devido à expiração do plano');
                            
                            // Redirecionar para login
                            window.location.href = 'login.html?expired=true';
                        } catch (error) {
                            error('❌ Erro durante logout forçado:', error);
                            // Se falhar no logout, apenas reload
                            location.reload();
                        }
                    }, 3000);
                    
                    return;
                }
                
                // Se não expirou, mostrar data de expiração no console
                log('✅ Plano Plus ativo até:', expirationDate.toLocaleString('pt-BR'));
            }
            
        } catch (error) {
            error('❌ Erro ao verificar expiração do plano:', error);
            // Não bloquear a página em caso de erro na verificação
        }
    }
    
    // Função para mostrar mensagens de feedback
    function showMessage(message, type = 'success') {
        // Remove mensagem anterior se existir
        const existingMessage = document.querySelector('.feedback-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Criar elemento de mensagem
        const messageDiv = document.createElement('div');
        messageDiv.className = `feedback-message ${type}`;
        messageDiv.textContent = message;
        
        // Adicionar ao card de alterar senha
        const passwordCard = updatePasswordBtn.closest('.function-card');
        passwordCard.insertBefore(messageDiv, passwordCard.querySelector('.card-body'));
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
    
    // Função para validar senha
    function validatePassword(password) {
        if (password.length < 6) {
            return 'A senha deve ter pelo menos 6 caracteres';
        }
        return null;
    }
    
    // Função principal para alterar senha
    async function changePassword() {
        if (!currentUser) {
            showMessage('Usuário não autenticado. Redirecionando...', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();
        
        // Validações
        if (!newPassword || !confirmPassword) {
            showMessage('Por favor, preencha todos os campos', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showMessage('As senhas não coincidem', 'error');
            return;
        }
        
        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            showMessage(passwordError, 'error');
            return;
        }
        
        // Desabilitar botão durante o processo
        updatePasswordBtn.disabled = true;
        updatePasswordBtn.textContent = 'Atualizando...';
        
        try {
            // Atualizar senha no Firebase
            await updatePassword(currentUser, newPassword);
            
            log('✅ Senha atualizada com sucesso');
            showMessage('Senha atualizada com sucesso!', 'success');
            
            // Limpar campos
            newPasswordInput.value = '';
            confirmPasswordInput.value = '';
            
        } catch (error) {
            error('❌ Erro ao atualizar senha:', error);
            
            // Tratamento de erros específicos
            let errorMessage = 'Erro ao atualizar senha. Tente novamente.';
            
            switch (error.code) {
                case 'auth/requires-recent-login':
                    errorMessage = 'Para alterar a senha, você precisa fazer login novamente. Redirecionando...';
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 3000);
                    break;
                case 'auth/weak-password':
                    errorMessage = 'A senha é muito fraca. Use pelo menos 6 caracteres.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Erro de conexão. Verifique sua internet.';
                    break;
                default:
                    errorMessage = `Erro: ${error.message}`;
            }
            
            showMessage(errorMessage, 'error');
        } finally {
            // Reabilitar botão
            updatePasswordBtn.disabled = false;
            updatePasswordBtn.textContent = 'Atualizar senha';
        }
    }
    
    // Event Listeners
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', changePassword);
    }
    
    // Permitir Enter nos campos de senha
    if (newPasswordInput) {
        newPasswordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                changePassword();
            }
        });
    }
    
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                changePassword();
            }
        });
    }
    
    // Botão voltar ao chat
    if (backToChatBtn) {
        backToChatBtn.addEventListener('click', function() {
            window.location.href = 'index.html';
        });
    }
    
    log('🔧 Event listeners configurados');
});
ff