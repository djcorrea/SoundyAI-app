// ✅ FIREBASE ADMIN - Importação do inicializador global
// Remove 100% do código MOCK - Firebase real sempre ativo

import { getAdmin, getAuth, getFirestore } from "../firebase/admin.js";

// Inicializar e obter instâncias
const admin = getAdmin();
export const auth = getAuth();
export const db = getFirestore();

export { admin };

