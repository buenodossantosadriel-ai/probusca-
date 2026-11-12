const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Permite que o seu site hospedado na Vercel acesse este servidor sem bloqueios (CORS)
app.use(cors());
app.use(express.json());

// Rota de verificação de saúde (para testar se o servidor está online na Render)
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    servico: 'ProBusca Backend API',
    mensagem: 'Servidor rodando perfeitamente na Render!' 
  });
});

// 1. Rota de Consulta Direta de CNPJ (usando BrasilAPI como fonte estável)
app.get('/api/cnpj/:cnpj', async (req, res) => {
  const cnpjLimpo = req.params.cnpj.replace(/\D/g, '');
  
  if (cnpjLimpo.length !== 14) {
    return res.status(400).json({ erro: 'CNPJ inválido. Digite 14 números.' });
  }

  try {
    const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
    res.json(response.data);
  } catch (error) {
    res.status(404).json({ erro: 'CNPJ não encontrado ou indisponível no momento.' });
  }
});

// 2. Rota de Ponte Invisível para o Telegram (CPF / Nome)
app.post('/api/consulta-avancada', async (req, res) => {
  const { documento, tipo } = req.body; // Ex: documento: '12345678900', tipo: 'cpf'

  if (!documento) {
    return res.status(400).json({ erro: 'Informe o CPF ou termo para consulta.' });
  }

  try {
    // AQUI ENTRARÁ A LÓGICA DO CLIENTE TELEGRAM (MTProto / GramJS)
    // O servidor enviará o comando ao bot nos bastidores, lerá a resposta e devolverá aqui.
    
    // Simulação de resposta estruturada para validar a comunicação com seu Front-End:
    res.json({
      sucesso: true,
      origem: 'automacao-interna',
      dados: {
        documento: documento,
        nome: 'AGUARDANDO CONEXAO TELEGRAM',
        status: 'Estrutura pronta para conectar sua sessão do Telegram'
      }
    });
  } catch (error) {
    res.status(500).json({ erro: 'Falha ao processar consulta nos bastidores.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor ProBusca rodando na porta ${PORT}`);
});
