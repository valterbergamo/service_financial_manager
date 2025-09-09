const mongoose = require('mongoose');

const investimentosSchema = new mongoose.Schema({
  descricao: {
    type: String,
    required: true,
    trim: true
  },
  categoria: {
    type: String,
    required: true,
    enum: [
      'poupanca', 'viagens', 'reserva_emergencia', 'aposentadoria', 
      'casa_propria', 'educacao', 'veiculo', 'outros'
    ]
  },
  valor_planejado: {
    type: Number,
    min: 0
  },
  valor_realizado: {
    type: Number,
    min: 0
  },
  saldo_atual: {
    type: Number,
    min: 0
  },
  mes_referencia: {
    type: Date,
    required: true
  },
  data_investimento: {
    type: Date
  },
  tipo: {
    type: String,
    required: true,
    enum: ['planejado', 'realizado', 'saldo_inicial']
  },
  fixo: {
    type: Boolean,
    default: false
  },
  origem_planejamento: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Investimentos', investimentosSchema);