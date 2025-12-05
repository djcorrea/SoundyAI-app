// Teste de sintaxe - estrutura do return em buildFinalJSON

const testObject = {
  metadata: {
    fileName: 'test',
    duration: 0,
    sampleRate: 48000,
    channels: 2,
    stage: 'output_scoring_completed',
    jobId: 'test-id',
    timestamp: new Date().toISOString()
  },

  // Campo data adicionado
  data: {
    genre: 'tech_house',
    genreTargets: null
  }
};

console.log('✅ Sintaxe válida:', testObject);
