const GastosRecorrentes = require('../models/GastosRecorrentes');

// GET /api/gastosRecorrentes - Listar todos os gastos recorrentes
exports.getAll = async (req, res) => {
  try {
    const { ativo, page = 1, limit = 50 } = req.query;
    const filter = {};
    
    if (ativo !== undefined) {
      filter.ativo = ativo === 'true';
    }

    const gastosRecorrentes = await GastosRecorrentes.find(filter)
      .sort({ dia_vencimento: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await GastosRecorrentes.countDocuments(filter);

    res.json({
      data: gastosRecorrentes,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total
      }
    });
  } catch (error) {
    console.error('Erro ao listar gastos recorrentes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// GET /api/gastosRecorrentes/:id - Buscar gasto recorrente por ID
exports.getById = async (req, res) => {
  try {
    const gastoRecorrente = await GastosRecorrentes.findById(req.params.id);
    
    if (!gastoRecorrente) {
      return res.status(404).json({ error: 'Gasto recorrente não encontrado' });
    }

    res.json({ data: gastoRecorrente });
  } catch (error) {
    console.error('Erro ao buscar gasto recorrente:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// POST /api/gastosRecorrentes - Criar novo gasto recorrente
exports.create = async (req, res) => {
  try {
    const gastoRecorrente = new GastosRecorrentes(req.body);
    const savedGastoRecorrente = await gastoRecorrente.save();

    res.status(201).json({ data: savedGastoRecorrente });
  } catch (error) {
    console.error('Erro ao criar gasto recorrente:', error);
    
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

// PUT /api/gastosRecorrentes/:id - Atualizar gasto recorrente
exports.update = async (req, res) => {
  try {
    const updatedGastoRecorrente = await GastosRecorrentes.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedGastoRecorrente) {
      return res.status(404).json({ error: 'Gasto recorrente não encontrado' });
    }

    res.json({ data: updatedGastoRecorrente });
  } catch (error) {
    console.error('Erro ao atualizar gasto recorrente:', error);
    
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

// DELETE /api/gastosRecorrentes/:id - Deletar gasto recorrente
exports.delete = async (req, res) => {
  try {
    const deletedGastoRecorrente = await GastosRecorrentes.findByIdAndDelete(req.params.id);

    if (!deletedGastoRecorrente) {
      return res.status(404).json({ error: 'Gasto recorrente não encontrado' });
    }

    res.json({ message: 'Gasto recorrente deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar gasto recorrente:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};