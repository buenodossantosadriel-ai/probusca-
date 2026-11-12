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
const botUsername = process.env.TELEGRAM_BOT_USERNAME;

let telegramClient = null;

// Estados temporários do fluxo de login web
let loginSession = null;
let telefoneTemp = null;
let resolveCodigo = null;
let resolveSenha = null;

async function iniciarTelegramConectado() {
  if (apiId && apiHash && process.env.TELEGRAM_SESSION) {
    telegramClient = new TelegramClient(new StringSession(process.env.TELEGRAM_SESSION), apiId, apiHash, { connectionRetries: 5 });
    await telegramClient.connect();
    console.log('✅ Sessão do Telegram conectada com sucesso!');
  }
}
iniciarTelegramConectado();

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

// ==========================================
// PAINEL WEB PASSO A PASSO NA RENDER (/login)
// ==========================================
app.get('/login', async (req, res) => {
  const { telefone, codigo, senha } = req.query;

  // Passo 3: Recebeu o código
  if (codigo && resolveCodigo) {
    resolveCodigo(codigo);
    resolveCodigo = null;
    return res.send(`<h2>Código recebido! A processar...</h2><p>Se tiver 2FA, atualize a página para inserir a senha. Caso contrário, olhe os logs da Render em 5 segundos para pegar a sua <code>TELEGRAM_SESSION</code>!</p>`);
  }

  // Passo 4: Recebeu a senha 2FA (se houver)
  if (senha && resolveSenha) {
    resolveSenha(senha);
    resolveSenha = null;
    return res.send(`<h2>Senha recebida! Finalizando...</h2><p>Olhe os logs da Render agora para copiar a sua <code>TELEGRAM_SESSION</code> gerada!</p>`);
  }

  // Passo 1: Se informou o telefone, inicia o pedido de envio do Telegram
  if (telefone && !loginSession) {
    telefoneTemp = telefone.trim();
    loginSession = new StringSession('');
    
    const tempClient = new TelegramClient(loginSession, apiId, apiHash, { connectionRetries: 5 });
    
    // Inicia o processo em segundo plano
    tempClient.start({
      phoneNumber: async () => telefoneTemp,
      phoneCode: async () => new Promise((resolve) => { resolveCodigo = resolve; }),
      password: async () => new Promise((resolve) => { resolveSenha = resolve; }),
      onError: (err) => console.log('Erro no fluxo:', err.message),
    }).then(() => {
      const sessaoFinal = tempClient.session.save();
      console.log('====================================================');
      console.log('🎉 TELEGRAM_SESSION GERADA COM SUCESSO NA RENDER:');
      console.log(sessaoFinal);
      console.log('====================================================');
    }).catch(e => console.log('Aviso de conclusão:', e.message));

    return res.send(`
      <h2>2. Código solicitado ao Telegram!</h2>
      <p>O Telegram enviou um código de confirmação para o aplicativo do número <b>${telefoneTemp}</b>.</p>
      <form action="/login" method="GET">
        <label><b>Digite o código recebido:</b></label><br><br>
        <input type="text" name="codigo" placeholder="Ex: 12345" style="padding:12px; font-size:18px;" required>
        <button type="submit" style="padding:12px 20px; font-size:18px; background:#28a745; color:#fff; border:none;">Enviar Código</button>
      </form>
    `);
  }

  // Se já existe sessão salva na Render
  if (process.env.TELEGRAM_SESSION) {
    return res.send('<h2>✅ A sua TELEGRAM_SESSION já está configurada e ativa nas variáveis da Render!</h2>');
  }

  // Passo 0: Tela inicial pedindo o telefone
  res.send(`
    <h2>Painel de Autenticação ProBusca - Telegram</h2>
    <p>Insira o seu número de telemóvel com DDI e DDD para iniciar:</p>
    <form action="/login" method="GET">
      <input type="text" name="telefone" value="+5549991017850" style="padding:12px; font-size:18px; width:280px;" required>
      <button type="submit" style="padding:12px 20px; font-size:18px; background:#007bff; color:#fff; border:none;">Solicitar Código</button>
    </form>
  `);
});

// Rota de Consulta do SaaS
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
