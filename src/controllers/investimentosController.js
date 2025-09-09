const Investimentos = require('../models/Investimentos');

// GET /api/investimentos - Listar todos os investimentos
exports.getAll = async (req, res) => {
  try {
    const { mes_referencia, categoria, tipo, page = 1, limit = 50 } = req.query;
    const filter = {};
    
    if (mes_referencia) {
      filter.mes_referencia = new Date(mes_referencia);
    }
    if (categoria) {
      filter.categoria = categoria;
    }
    if (tipo) {
      filter.tipo = tipo;
    }

    const investimentos = await Investimentos.find(filter)
      .sort({ mes_referencia: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Investimentos.countDocuments(filter);

    res.json({
      data: investimentos,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total
      }
    });
  } catch (error) {
    console.error('Erro ao listar investimentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// GET /api/investimentos/:id - Buscar investimento por ID
exports.getById = async (req, res) => {
  try {
    const investimento = await Investimentos.findById(req.params.id);
    
    if (!investimento) {
      return res.status(404).json({ error: 'Investimento não encontrado' });
    }

    res.json({ data: investimento });
  } catch (error) {
    console.error('Erro ao buscar investimento:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// POST /api/investimentos - Criar novo investimento
exports.create = async (req, res) => {
  try {
    const investimento = new Investimentos(req.body);
    const savedInvestimento = await investimento.save();

    res.status(201).json({ data: savedInvestimento });
  } catch (error) {
    console.error('Erro ao criar investimento:', error);
    
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

// PUT /api/investimentos/:id - Atualizar investimento
exports.update = async (req, res) => {
  try {
    const updatedInvestimento = await Investimentos.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedInvestimento) {
      return res.status(404).json({ error: 'Investimento não encontrado' });
    }

    res.json({ data: updatedInvestimento });
  } catch (error) {
    console.error('Erro ao atualizar investimento:', error);
    
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

// DELETE /api/investimentos/:id - Deletar investimento
exports.delete = async (req, res) => {
  try {
    const deletedInvestimento = await Investimentos.findByIdAndDelete(req.params.id);

    if (!deletedInvestimento) {
      return res.status(404).json({ error: 'Investimento não encontrado' });
    }

    res.json({ message: 'Investimento deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar investimento:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};