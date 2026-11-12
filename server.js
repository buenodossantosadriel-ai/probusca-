const express = require('express');
const cors = require('cors');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION || '');
const botUsername = process.env.TELEGRAM_BOT_USERNAME;
const meuTelefone = process.env.TELEGRAM_PHONE; // Número salvo na Render

let telegramClient = null;

async function iniciarTelegram() {
  if (apiId && apiHash) {
    telegramClient = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });

    if (!process.env.TELEGRAM_SESSION && meuTelefone) {
      console.log('🔄 Nenhuma sessão encontrada. Iniciando autenticação automática para:', meuTelefone);
      try {
        await telegramClient.start({
          phoneNumber: async () => meuTelefone,
          phoneCode: async () => {
            console.log('====================================================');
            console.log('📱 CÓDIGO DE LOGIN SOLICITADO AO TELEGRAM!');
            console.log('Por favor, olhe os logs da Render para ver o código ou digite no Telegram.');
            console.log('====================================================');
            // Como estamos sem interatividade via terminal web direto, 
            // vamos usar um método alternativo simples abaixo se precisar.
            return ''; 
          },
          onError: (err) => console.error('Erro no login:', err),
        });
      } catch (e) {
        console.log('Aviso de login:', e.message);
      }
    } else {
      await telegramClient.connect();
      console.log('✅ Sessão do Telegram conectada com sucesso!');
    }
  }
}
iniciarTelegram();

const MAPA_COMANDOS = {
  nome: '/nome',
  cpf: '/cpf3',
  cnpj: '/cnpj',
  telefone: '/telefone',
  email: '/email',
  placa: '/placa'
};

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    servico: 'ProBusca Backend API',
    telegramConectado: Boolean(telegramClient && telegramClient.connected),
    sessaoSalva: Boolean(process.env.TELEGRAM_SESSION)
  });
});

// Rota de Consulta do SaaS
app.post('/api/consultar', async (req, res) => {
  const { tipo, termo } = req.body;

  if (!tipo || !termo) {
    return res.status(400).json({ erro: 'Informe o tipo de busca e o termo a consultar.' });
  }

  const comandoBase = MAPA_COMANDOS[tipo.toLowerCase()];
  if (!comandoBase) {
    return res.status(400).json({ erro: 'Tipo de consulta não suportado.' });
  }

  const mensagemParaEnviar = `${comandoBase} ${termo.trim()}`;

  try {
    if (telegramClient && telegramClient.connected && botUsername) {
      const msgEnviada = await telegramClient.sendMessage(botUsername, {
        message: mensagemParaEnviar,
      });

      await new Promise((resolve) => setTimeout(resolve, 4500));

      const mensagens = await telegramClient.getMessages(botUsername, { limit: 3 });
      const respostaBot = mensagens.find((m) => m.id > msgEnviada.id && !m.out);

      if (!respostaBot || !respostaBot.message) {
        return res.status(504).json({ erro: 'O bot demorou para responder. Tente novamente.' });
      }

      return res.json({
        sucesso: true,
        comandoExecutado: tipo,
        resultado: respostaBot.message
      });
    }

    return res.status(503).json({ erro: 'Sessão do Telegram não conectada.' });
  } catch (error) {
    console.error('Erro na consulta:', error);
    res.status(500).json({ erro: 'Erro interno ao processar a consulta.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor ProBusca rodando na porta ${PORT}`);
});
