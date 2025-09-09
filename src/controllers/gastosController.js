const Gastos = require('../models/Gastos');

// GET /api/gastos - Listar todos os gastos
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

    const gastos = await Gastos.find(filter)
      .sort({ mes_referencia: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Gastos.countDocuments(filter);

    res.json({
      data: gastos,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total
      }
    });
  } catch (error) {
    console.error('Erro ao listar gastos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// GET /api/gastos/:id - Buscar gasto por ID
exports.getById = async (req, res) => {
  try {
    const gasto = await Gastos.findById(req.params.id);
    
    if (!gasto) {
      return res.status(404).json({ error: 'Gasto não encontrado' });
    }

    res.json({ data: gasto });
  } catch (error) {
    console.error('Erro ao buscar gasto:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// POST /api/gastos - Criar novo gasto
exports.create = async (req, res) => {
  try {
    const gasto = new Gastos(req.body);
    const savedGasto = await gasto.save();

    res.status(201).json({ data: savedGasto });
  } catch (error) {
    console.error('Erro ao criar gasto:', error);
    
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

// PUT /api/gastos/:id - Atualizar gasto
exports.update = async (req, res) => {
  try {
    const updatedGasto = await Gastos.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedGasto) {
      return res.status(404).json({ error: 'Gasto não encontrado' });
    }

    res.json({ data: updatedGasto });
  } catch (error) {
    console.error('Erro ao atualizar gasto:', error);
    
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

// DELETE /api/gastos/:id - Deletar gasto
exports.delete = async (req, res) => {
  try {
    const deletedGasto = await Gastos.findByIdAndDelete(req.params.id);

    if (!deletedGasto) {
      return res.status(404).json({ error: 'Gasto não encontrado' });
    }

    res.json({ message: 'Gasto deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar gasto:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};