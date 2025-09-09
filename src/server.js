require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Importar controladores
const proventosController = require('./controllers/proventosController');
const gastosController = require('./controllers/gastosController');
const gastosRecorrentesController = require('./controllers/gastosRecorrentesController');
const investimentosController = require('./controllers/investimentosController');

const app = express();
const PORT = process.env.PORT || 3001;

// Debug: Mostrar variáveis de ambiente carregadas
console.log('🔧 Variáveis de ambiente carregadas:');
console.log('MONGO_HOST:', process.env.MONGO_HOST);
console.log('MONGO_PORT:', process.env.MONGO_PORT);
console.log('MONGO_DATABASE:', process.env.MONGO_DATABASE);
console.log('MONGO_USERNAME:', process.env.MONGO_USERNAME);
console.log('PORT:', process.env.PORT);

// Middleware - CORS configurado para aceitar todas as origens
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Configuração do MongoDB com Mongoose
const MONGO_URL = `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DATABASE}?authSource=admin`;

console.log('🔗 URL de conexão MongoDB:', MONGO_URL.replace(process.env.MONGO_PASSWORD, '***'));

// Conectar ao MongoDB usando Mongoose
mongoose.connect(MONGO_URL)
  .then(() => {
    console.log('✅ Conectado ao MongoDB via Mongoose');
  })
  .catch(error => {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    console.error('URL tentada:', MONGO_URL.replace(process.env.MONGO_PASSWORD, '***'));
    process.exit(1);
  });

// Middleware para verificar conexão com DB
app.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Banco de dados não disponível' });
  }
  next();
});

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    service: 'Financial Manager API'
  });
});

// ===== ROTAS PARA PROVENTOS =====
app.get('/api/proventos', proventosController.getAll);
app.get('/api/proventos/:id', proventosController.getById);
app.post('/api/proventos', proventosController.create);
app.put('/api/proventos/:id', proventosController.update);
app.delete('/api/proventos/:id', proventosController.delete);

// ===== ROTAS PARA GASTOS =====
app.get('/api/gastos', gastosController.getAll);
app.get('/api/gastos/:id', gastosController.getById);
app.post('/api/gastos', gastosController.create);
app.put('/api/gastos/:id', gastosController.update);
app.delete('/api/gastos/:id', gastosController.delete);

// ===== ROTAS PARA GASTOS RECORRENTES =====
app.get('/api/gastosRecorrentes', gastosRecorrentesController.getAll);
app.get('/api/gastosRecorrentes/:id', gastosRecorrentesController.getById);
app.post('/api/gastosRecorrentes', gastosRecorrentesController.create);
app.put('/api/gastosRecorrentes/:id', gastosRecorrentesController.update);
app.delete('/api/gastosRecorrentes/:id', gastosRecorrentesController.delete);

// ===== ROTAS PARA INVESTIMENTOS =====
app.get('/api/investimentos', investimentosController.getAll);
app.get('/api/investimentos/:id', investimentosController.getById);
app.post('/api/investimentos', investimentosController.create);
app.put('/api/investimentos/:id', investimentosController.update);
app.delete('/api/investimentos/:id', investimentosController.delete);

// Middleware para tratar rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Middleware para tratar erros
app.use((error, req, res, next) => {
  console.error('Erro não tratado:', error);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor de Gerenciamento Financeiro rodando na porta ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💰 Rotas disponíveis:`);
  console.log(`   - Proventos: http://localhost:${PORT}/api/proventos`);
  console.log(`   - Gastos: http://localhost:${PORT}/api/gastos`);
  console.log(`   - Gastos Recorrentes: http://localhost:${PORT}/api/gastosRecorrentes`);
  console.log(`   - Investimentos: http://localhost:${PORT}/api/investimentos`);
});