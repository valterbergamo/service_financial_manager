const mongoose = require('mongoose');

const proventosSchema = new mongoose.Schema({
  descricao: {
    type: String,
    required: true,
    trim: true
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
  data_recebimento: {
    type: Date
  },
  tipo: {
    type: String,
    required: true,
    enum: ['planejado', 'realizado']
  },
  recorrente: {
    type: Boolean,
    default: false
  },
  origem_planejamento: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Proventos', proventosSchema);