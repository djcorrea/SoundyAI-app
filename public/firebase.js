// firebase.js - Configuração Firebase Corrigida
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth, browserLocalPersistence, setPersistence } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
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

// ✅ Garantir persistência local explícita (browserLocalPersistence é o padrão,
// mas definir explicitamente protege contra regressões e ambientes edge-case).
// Tokens ficam em IndexedDB, sobrevivem a refreshes e navegação entre páginas
// DO MESMO DOMÍNIO. Nunca usar URLs absolutas com www↔non-www entre páginas.
setPersistence(auth, browserLocalPersistence).catch(function(e) {
  log('⚠️ [FIREBASE] setPersistence falhou (não crítico):', e.message);
});

log('🔥 Firebase config carregado');