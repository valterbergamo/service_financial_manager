const mongoose = require('mongoose');

const gastosRecorrentesSchema = new mongoose.Schema({
  descricao: {
    type: String,
    required: true,
    trim: true
  },
  valor: {
    type: Number,
    required: true,
    min: 0
  },
  dia_vencimento: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  },
  ativo: {
    type: Boolean,
    default: true
  },
  data_inicio: {
    type: Date,
    required: true
  },
  data_fim: {
    type: Date
  },
  tipo_pagamento: {
    type: String,
    enum: ['cartao_credito', 'debito_automatico', 'boleto', 'pix']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('GastosRecorrentes', gastosRecorrentesSchema);