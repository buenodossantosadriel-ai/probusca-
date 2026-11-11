const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Rota padrão / raiz
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor probusca online!' });
});

// Rota de status (Health Check)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API de busca rodando!' });
});

// 1. Rota para buscar CNPJ via BrasilAPI
app.get('/api/cnpj/:cnpj', async (req, res) => {
  try {
    const cnpj = req.params.cnpj.replace(/\D/g, ''); // Remove caracteres não numéricos
    const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    return res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'CNPJ não encontrado' });
    }
    return res.status(500).json({ error: 'Erro ao consultar a BrasilAPI' });
  }
});

// 2. NOVA ROTA: Buscar situação cadastral de CPF via BrasilAPI
app.get('/api/cpf/:cpf', async (req, res) => {
  try {
    const cpf = req.params.cpf.replace(/\D/g, ''); // Remove pontos e traços
    
    // Validação básica do tamanho do CPF
    if (cpf.length !== 11) {
      return res.status(400).json({ error: 'CPF deve conter 11 dígitos' });
    }

    const response = await axios.get(`https://brasilapi.com.br/api/cpf/v1/${cpf}`);
    return res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'CPF não encontrado ou inválido' });
    }
    return res.status(500).json({ error: 'Erro ao consultar a BrasilAPI' });
  }
});

// Exportação obrigatória para a Vercel Serverless
module.exports = app;
