// api/firebaseAdmin.dev.js - Mock para desenvolvimento local
console.log('🔧 Using Firebase Admin mock for development');

// Mock auth
const mockAuth = {
  verifyIdToken: async (token) => {
    if (token === 'test-token' || token.startsWith('valid-')) {
      return {
        uid: 'test-user-123',
        email: 'test@example.com'
      };
    }
    throw new Error('Invalid token');
  }
};

// Mock db
const mockDb = {
  collection: (name) => ({
    doc: (id) => ({
      get: async () => ({
        exists: false,
        data: () => null
      }),
      set: async (data) => data,
      update: async (data) => data
    })
  }),
  runTransaction: async (fn) => {
    const mockTx = {
      get: async () => ({ exists: false }),
      set: async (ref, data) => data,
      update: async (ref, data) => data
    };
    return await fn(mockTx);
  }
};

export const auth = mockAuth;
export const db = mockDb;
