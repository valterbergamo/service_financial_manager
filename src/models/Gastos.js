const mongoose = require('mongoose');

const gastosSchema = new mongoose.Schema({
  descricao: {
    type: String,
    required: true,
    trim: true
  },
  categoria: {
    type: String,
    required: true,
    enum: [
      'fixo', 'variavel', 'mercado', 'combustivel', 'farmacia', 
      'despesas_medicas', 'lazer', 'educacao', 'transporte', 
      'alimentacao', 'vestuario', 'casa', 'servicos', 'impostos', 
      'seguros', 'outros'
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
  mes_referencia: {
    type: Date,
    required: true
  },
  data_gasto: {
    type: Date
  },
  tipo: {
    type: String,
    required: true,
    enum: ['planejado', 'realizado']
  },
  fixo: {
    type: Boolean,
    default: false
  },
  local_mercado: {
    type: String,
    trim: true
  },
  km: {
    type: Number,
    min: 0
  },
  litros: {
    type: Number,
    min: 0
  },
  valor_total: {
    type: Number,
    min: 0
  },
  origem_planejamento: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Gastos', gastosSchema);