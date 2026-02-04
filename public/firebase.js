// firebase.js - Configuração Firebase Corrigida
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';

// Configuração do Firebase (configuração correta do projeto)
const firebaseConfig = {
  apiKey: "AIzaSyBKby0RdIOGorhrfBRMCWnL25peU3epGTw",
  authDomain: "prodai-58436.firebaseapp.com",
  projectId: "prodai-58436",
  storageBucket: "prodai-58436.appspot.com",
  messagingSenderId: "801631191322",
  appId: "1:801631322:web:80e3d29cf7468331652ca3",
  measurementId: "G-MBDHDYN6Z0"
};

// Inicializar Firebase apenas uma vez
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  log('✅ Firebase inicializado com sucesso');
} else {
  app = getApps()[0];
  log('✅ Firebase já estava inicializado');
}

// Exportar instâncias
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ CORREÇÃO 2026-02-04: Flag firebaseReady confiável
// Só é setada após auth estar realmente sincronizado
window.firebaseReady = false;
window.__firebaseInitStart = Date.now();

auth.onAuthStateChanged(() => {
    if (!window.firebaseReady) {
        window.firebaseReady = true;
        const elapsed = Date.now() - window.__firebaseInitStart;
        log(`✅ [FIREBASE] Firebase pronto e sincronizado (${elapsed}ms)`);
        window.dispatchEvent(new CustomEvent('firebase:ready'));
        
        // Disparar evento para plan-capabilities recarregar plano
        if (auth.currentUser) {
            log('[FIREBASE] Usuário detectado, disparando evento plan:reload');
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('firebase:user-ready', { detail: auth.currentUser }));
            }, 100);
        }
    }
});

log('🔥 Firebase config carregado');