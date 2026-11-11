const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API de busca rodando!' });
});

// Rota padrão/raiz
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor probusca online!' });
});

// Rota para buscar CNPJ via BrasilAPI
app.get('/api/cnpj/:cnpj', async (req, res) => {
  try {
    const cnpj = req.params.cnpj.replace(/\D/g, '');
    const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    return res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'CNPJ não encontrado' });
    }
    return res.status(500).json({ error: 'Erro ao consultar a BrasilAPI' });
  }
});

// Exportação obrigatória para a Vercel Serverless
module.exports = app;
