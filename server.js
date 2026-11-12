const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configurações da sua conta Telegram (serão colocadas nas Variáveis de Ambiente da Render por segurança)
const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION || '');
const botUsername = process.env.TELEGRAM_BOT_USERNAME; // Ex: '@NomeDoBotDeBusca'

let telegramClient = null;

// Inicializa a conexão com o Telegram caso as credenciais estejam configuradas
async function iniciarTelegram() {
  if (apiId && apiHash && process.env.TELEGRAM_SESSION) {
    telegramClient = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });
    await telegramClient.connect();
    console.log('✅ Sessão do Telegram conectada com sucesso nos bastidores!');
  } else {
    console.log('⚠️ Aguardando configuração das variáveis de sessão do Telegram na Render.');
  }
}
iniciarTelegram();

// Mapa exato dos comandos do seu Bot
const MAPA_COMANDOS = {
  nome: '/nome',
  cpf: '/cpf3',
  cnpj: '/cnpj',
  telefone: '/telefone',
  email: '/email',
  placa: '/placa'
};

// Rota de status
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    servico: 'ProBusca Backend API',
    telegramConectado: Boolean(telegramClient && telegramClient.connected)
  });
});

// Rota Principal de Consulta Invisível
app.post('/api/consultar', async (req, res) => {
  const { tipo, termo } = req.body; // Ex: tipo: 'cpf', termo: '12345678900'

  if (!tipo || !termo) {
    return res.status(400).json({ erro: 'Informe o tipo de busca e o termo a consultar.' });
  }

  const comandoBase = MAPA_COMANDOS[tipo.toLowerCase()];
  if (!comandoBase) {
    return res.status(400).json({ erro: 'Tipo de consulta não suportado.' });
  }

  // Monta o comando exato: ex. "/cpf3 12345678900" ou "/placa ABC1D23"
  const mensagemParaEnviar = `${comandoBase} ${termo.trim()}`;

  try {
    // Se a sessão do Telegram já estiver ativa, faz a busca real
    if (telegramClient && telegramClient.connected && botUsername) {
      // 1. Envia o comando para o bot
      const msgEnviada = await telegramClient.sendMessage(botUsername, {
        message: mensagemParaEnviar,
      });

      // 2. Aguarda alguns segundos para o bot processar e responder
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // 3. Lê as últimas mensagens do chat com o bot para pegar a resposta
      const mensagens = await telegramClient.getMessages(botUsername, { limit: 2 });
      const respostaBot = mensagens.find((m) => m.id > msgEnviada.id && !m.out);

      if (!respostaBot || !respostaBot.message) {
        return res.status(504).json({ erro: 'O servidor de dados demorou para responder. Tente novamente.' });
      }

      return res.json({
        sucesso: true,
        comandoExecutado: tipo,
        resultado: respostaBot.message
      });
    }

    // Retorno de simulação enquanto você ainda não inseriu as chaves da sessão
    return res.json({
      sucesso: true,
      modoSimulacao: true,
      comandoPreparado: mensagemParaEnviar,
      resultado: `Simulação concluída para [${mensagemParaEnviar}]. Conecte as chaves do Telegram na Render para receber os dados reais.`
    });

  } catch (error) {
    console.error('Erro na consulta:', error);
    res.status(500).json({ erro: 'Erro interno ao processar a consulta.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor ProBusca rodando na porta ${PORT}`);
});
