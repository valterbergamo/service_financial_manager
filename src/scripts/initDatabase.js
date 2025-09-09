require('dotenv').config();
const mongoose = require('mongoose');
const Connection = require('../models/Connection');

const MONGO_URL = `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DATABASE}`;

async function initDatabase() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(MONGO_URL);
    console.log('✅ Conectado ao MongoDB');

    // Limpar coleção existente (opcional)
    await Connection.deleteMany({});
    console.log('🗑️ Coleção limpa');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Desconectado do MongoDB');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;