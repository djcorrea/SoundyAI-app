// ✅ FIREBASE ADMIN - Importação do inicializador global
// Usado quando importado do server.js da raiz

import { getAdmin, getAuth, getFirestore } from "../firebase/admin.js";

// Inicializar e obter instâncias
const admin = getAdmin();
export const auth = getAuth();
export const db = getFirestore();

export { admin };