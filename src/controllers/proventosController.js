const Proventos = require('../models/Proventos');

// GET /api/proventos - Listar todos os proventos
exports.getAll = async (req, res) => {
  try {
    const { mes_referencia, tipo, page = 1, limit = 50 } = req.query;
    const filter = {};
    
    if (mes_referencia) {
      filter.mes_referencia = new Date(mes_referencia);
    }
    if (tipo) {
      filter.tipo = tipo;
    }

    const proventos = await Proventos.find(filter)
      .sort({ mes_referencia: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Proventos.countDocuments(filter);

    res.json({
      data: proventos,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total
      }
    });
  } catch (error) {
    console.error('Erro ao listar proventos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// GET /api/proventos/:id - Buscar provento por ID
exports.getById = async (req, res) => {
  try {
    const provento = await Proventos.findById(req.params.id);
    
    if (!provento) {
      return res.status(404).json({ error: 'Provento não encontrado' });
    }

    res.json({ data: provento });
  } catch (error) {
    console.error('Erro ao buscar provento:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// POST /api/proventos - Criar novo provento
exports.create = async (req, res) => {
  try {
    const provento = new Proventos(req.body);
    const savedProvento = await provento.save();

    res.status(201).json({ data: savedProvento });
  } catch (error) {
    console.error('Erro ao criar provento:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: validationErrors 
      });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// PUT /api/proventos/:id - Atualizar provento
exports.update = async (req, res) => {
  try {
    const updatedProvento = await Proventos.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedProvento) {
      return res.status(404).json({ error: 'Provento não encontrado' });
    }

    res.json({ data: updatedProvento });
  } catch (error) {
    console.error('Erro ao atualizar provento:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: validationErrors 
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// DELETE /api/proventos/:id - Deletar provento
exports.delete = async (req, res) => {
  try {
    const deletedProvento = await Proventos.findByIdAndDelete(req.params.id);

    if (!deletedProvento) {
      return res.status(404).json({ error: 'Provento não encontrado' });
    }

    res.json({ message: 'Provento deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar provento:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};