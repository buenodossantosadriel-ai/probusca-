const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint de teste da API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API de busca rodando!' });
});

// Endpoint para buscar CNPJ via BrasilAPI
app.get('/api/cnpj/:cnpj', async (req, res) => {
  try {
    const cnpj = req.params.cnpj.replace(/\D/g, ''); // Limpa pontuações
    const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    
    return res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'CNPJ não encontrado' });
    }
    return res.status(500).json({ error: 'Erro ao consultar a BrasilAPI' });
  }
});

// Essencial para rodar localmente e na Vercel
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

// OBRIGATÓRIO PARA A VERCEL FUNCIONAR
module.exports = app;
