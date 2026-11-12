const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Permite que o seu front-end na Vercel acesse este backend sem bloqueios (CORS)
app.use(cors());
app.use(express.json());

// Rota de verificação de saúde (para confirmar que o servidor está online)
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

// 2. Rota Avançada de Ponte Invisível para o Telegram (CPF / Nome / Outros)
app.post('/api/consulta-avancada', async (req, res) => {
  const { documento, tipo } = req.body; 

  if (!documento) {
    return res.status(400).json({ erro: 'Informe o documento ou termo para consulta.' });
  }

  try {
    // AQUI É ONDE O BOT DO TELEGRAM ENTRA EM AÇÃO NOS BASTIDORES:
    // 1. O servidor Node.js envia o comando/documento para o chat do bot que você tem acesso.
    // 2. Aguarda a resposta (texto ou dados retornados pelo bot).
    // 3. Trata e limpa o texto recebido para transformar em um JSON limpo.

    // Resposta estruturada de teste para conectar e validar com o seu Front-End
    res.json({
      sucesso: true,
      mensagem: 'Consulta realizada com sucesso pelos bastidores',
      dados: {
        tipoConsulta: tipo || 'geral',
        termoConsultado: documento,
        resultadoBruto: 'Aqui virão os dados extraídos da resposta do bot do Telegram',
        status: 'Processado de forma invisível'
      }
    });

  } catch (error) {
    console.error('Erro na automação do Telegram:', error);
    res.status(500).json({ erro: 'Falha ao comunicar com o canal de consulta nos bastidores.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor ProBusca rodando na porta ${PORT}`);
});
