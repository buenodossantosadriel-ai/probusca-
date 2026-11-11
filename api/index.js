const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Rota raiz
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor probusca online!' });
});

// Rota de status (Health Check)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API de busca rodando!' });
});

// 1. Rota para buscar CNPJ direto
app.get('/api/cnpj/:cnpj', async (req, res) => {
  try {
    const cnpj = req.params.cnpj.replace(/\D/g, '');
    const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    return res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'CNPJ não encontrado' });
    }
    return res.status(500).json({ error: 'Erro ao consultar o CNPJ' });
  }
});

// 2. Rota para buscar situação de CPF
app.get('/api/cpf/:cpf', async (req, res) => {
  try {
    const cpf = req.params.cpf.replace(/\D/g, '');
    if (cpf.length !== 11) {
      return res.status(400).json({ error: 'CPF deve conter 11 dígitos' });
    }
    const response = await axios.get(`https://brasilapi.com.br/api/cpf/v1/${cpf}`);
    return res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'CPF não encontrado ou inválido' });
    }
    return res.status(500).json({ error: 'Erro ao consultar o CPF' });
  }
});

// 3. Rota para pesquisar empresas por Nome / Razão Social
app.get('/api/nome/:termo', async (req, res) => {
  try {
    const termo = encodeURIComponent(req.params.termo);
    const response = await axios.get(`https://publica.cnpj.ws/cnpj/busca?razao_social=${termo}`);
    return res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Nenhuma empresa encontrada com este nome' });
    }
    return res.status(500).json({ error: 'Erro ao pesquisar empresas por nome' });
  }
});

// 4. Rota para listar empresas por UF e termo opcional
app.get('/api/estado/:uf', async (req, res) => {
  try {
    const uf = req.params.uf.toUpperCase();
    const termo = req.query.termo || ''; 
    
    let url = `https://publica.cnpj.ws/cnpj/busca?uf=${uf}`;
    if (termo) {
      url += `&razao_social=${encodeURIComponent(termo)}`;
    }

    const response = await axios.get(url);
    return res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Nenhuma empresa encontrada para os critérios informados' });
    }
    return res.status(500).json({ error: 'Erro ao pesquisar empresas por estado' });
  }
});

module.exports = app;
