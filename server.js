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
const meuTelefone = process.env.TELEGRAM_PHONE;

let telegramClient = null;
let clienteTemp = null;
let resolverCodigo = null;
let resolverSenha = null;

async function iniciarTelegram() {
  if (apiId && apiHash && process.env.TELEGRAM_SESSION) {
    telegramClient = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
    await telegramClient.connect();
    console.log('✅ Sessão do Telegram conectada com sucesso!');
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

// =========================================================================
// PAINEL WEB DE LOGIN SIMPLES (Acesse no navegador do seu telemóvel)
// =========================================================================
app.get('/login', async (req, res) => {
  const { codigo, senha } = req.query;

  if (codigo && resolverCodigo) {
    resolverCodigo(codigo);
    resolverCodigo = null;
    return res.send('<h3>Código recebido! Finalizando conexão... Atualize esta página em 3 segundos.</h3>');
  }

  if (senha && resolverSenha) {
    resolverSenha(senha);
    resolverSenha = null;
    return res.send('<h3>Senha 2FA recebida! Finalizando conexão... Atualize esta página em 3 segundos.</h3>');
  }

  if (!process.env.TELEGRAM_SESSION && !clienteTemp && meuTelefone) {
    try {
      clienteTemp = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 });
      clienteTemp.start({
        phoneNumber: async () => meuTelefone,
        phoneCode: async () => new Promise((resolve) => { resolverCodigo = resolve; }),
        password: async () => new Promise((resolve) => { resolverSenha = resolve; }),
        onError: (err) => console.log('Erro:', err.message),
      }).then(() => {
        const sessaoGerada = clienteTemp.session.save();
        console.log('=== TELEGRAM_SESSION GERADA COM SUCESSO ===');
        console.log(sessaoGerada);
      });
    } catch (e) {
      console.log('Erro ao iniciar:', e);
    }
  }

  if (process.env.TELEGRAM_SESSION) {
    return res.send('<h2>✅ A sua TELEGRAM_SESSION já está configurada e ativa na Render!</h2>');
  }

  res.send(`
    <h2>Painel de Autenticação Telegram - ProBusca</h2>
    <p>1. Se acabou de abrir, o Telegram já enviou o código para o seu telemóvel.</p>
    <form action="/login" method="GET">
      <label>Insira o código do Telegram:</label><br><br>
      <input type="text" name="codigo" placeholder="Ex: 12345" style="padding:10px; font-size:16px;" required>
      <button type="submit" style="padding:10px 20px; font-size:16px;">Enviar Código</button>
    </form>
    <br><hr><br>
    <p>Caso utilize verificação em duas etapas (Senha):</p>
    <form action="/login" method="GET">
      <input type="text" name="senha" placeholder="Sua senha 2FA" style="padding:10px; font-size:16px;">
      <button type="submit" style="padding:10px 20px; font-size:16px;">Enviar Senha</button>
    </form>
  `);
});

// Rota de Consulta
app.post('/api/consultar', async (req, res) => {
  const { tipo, termo } = req.body;
  if (!tipo || !termo) return res.status(400).json({ erro: 'Informe o tipo e o termo.' });

  const comandoBase = MAPA_COMANDOS[tipo.toLowerCase()];
  if (!comandoBase) return res.status(400).json({ erro: 'Tipo não suportado.' });

  const mensagemParaEnviar = `${comandoBase} ${termo.trim()}`;

  try {
    if (telegramClient && telegramClient.connected && botUsername) {
      const msgEnviada = await telegramClient.sendMessage(botUsername, { message: mensagemParaEnviar });
      await new Promise((resolve) => setTimeout(resolve, 4500));
      const mensagens = await telegramClient.getMessages(botUsername, { limit: 3 });
      const respostaBot = mensagens.find((m) => m.id > msgEnviada.id && !m.out);

      if (!respostaBot || !respostaBot.message) {
        return res.status(504).json({ erro: 'O bot demorou para responder.' });
      }
      return res.json({ sucesso: true, comandoExecutado: tipo, resultado: respostaBot.message });
    }
    return res.status(503).json({ erro: 'Sessão do Telegram não conectada.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro interno ao processar a consulta.' });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
