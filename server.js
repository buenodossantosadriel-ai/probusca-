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
let loginSession = null;
let telefoneTemp = null;
let resolveCodigo = null;
let resolveSenha = null;

async function iniciarTelegramConectado() {
  try {
    if (apiId && apiHash && process.env.TELEGRAM_SESSION) {
      telegramClient = new TelegramClient(new StringSession(process.env.TELEGRAM_SESSION), apiId, apiHash, { connectionRetries: 5 });
      await telegramClient.connect();
      console.log('✅ Sessão do Telegram conectada com sucesso!');
    }
  } catch (err) {
    console.log('Erro ao conectar sessão salva:', err.message);
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

// ==========================================
// ROTA PRINCIPAL: FRONT-END VISUAL DA APLICAÇÃO
// ==========================================
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ProBusca - Consulta Telegram</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 90vh; }
        .card { background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 450px; }
        h2 { margin-top: 0; color: #333; text-align: center; }
        label { display: block; margin-top: 15px; font-weight: bold; color: #555; }
        select, input, button { width: 100%; padding: 12px; margin-top: 5px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 16px; }
        button { background: #007bff; color: white; border: none; margin-top: 20px; cursor: pointer; font-weight: bold; }
        button:hover { background: #0056b3; }
        pre { background: #e9ecef; padding: 12px; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; max-height: 300px; overflow-y: auto; font-size: 14px; margin-top: 20px; }
        .links { margin-top: 15px; text-align: center; font-size: 14px; }
        .links a { color: #007bff; text-decoration: none; }
    </style>
</head>
<body>

<div class="card">
    <h2>ProBusca Consulta</h2>
    
    <label for="tipo">Tipo de Consulta:</label>
    <select id="tipo">
        <option value="telefone">Telefone</option>
        <option value="nome">Nome</option>
        <option value="cpf">CPF</option>
        <option value="cnpj">CNPJ</option>
        <option value="email">E-mail</option>
        <option value="placa">Placa</option>
    </select>

    <label for="termo">Termo a pesquisar:</label>
    <input type="text" id="termo" value="49991017850" placeholder="Digite o valor...">

    <button onclick="realizarConsulta()">Consultar</button>

    <pre id="resultado">Aguardando consulta...</pre>

    <div class="links">
        <a href="/login" target="_blank">Gerir / Reautenticar Sessão Telegram</a>
    </div>
</div>

<script>
    async function realizarConsulta() {
        const tipo = document.getElementById('tipo').value;
        const termo = document.getElementById('termo').value;
        const resultadoBox = document.getElementById('resultado');

        if (!termo) {
            alert('Por favor, preencha o termo de busca.');
            return;
        }

        resultadoBox.textContent = 'A consultar, aguarde alguns segundos...';

        try {
            const resposta = await fetch('/api/consultar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo, termo })
            });

            const dados = await resposta.json();

            if (resposta.ok) {
                resultadoBox.textContent = dados.resultado;
            } else {
                resultadoBox.textContent = 'Erro: ' + (dados.erro || 'Falha na consulta');
            }
        } catch (error) {
            resultadoBox.textContent = 'Erro de conexão com o servidor.';
            console.error(error);
        }
    }
</script>

</body>
</html>
  `);
});

// ==========================================
// PAINEL WEB DE LOGIN DO TELEGRAM (/login)
// ==========================================
app.get('/login', async (req, res) => {
  const { telefone, codigo, senha } = req.query;

  if (codigo && resolveCodigo) {
    resolveCodigo(codigo);
    resolveCodigo = null;
    return res.send(`<h2>Código recebido! A processar...</h2><p>Verifique os logs da Render em instantes para copiar a sua <code>TELEGRAM_SESSION</code>!</p>`);
  }

  if (senha && resolveSenha) {
    resolveSenha(senha);
    resolveSenha = null;
    return res.send(`<h2>Senha recebida! Finalizando...</h2><p>Verifique os logs da Render agora!</p>`);
  }

  if (telefone && !loginSession) {
    telefoneTemp = telefone.trim();
    loginSession = new StringSession('');
    
    try {
      const tempClient = new TelegramClient(loginSession, apiId, apiHash, { connectionRetries: 3 });
      
      tempClient.start({
        phoneNumber: async () => telefoneTemp,
        phoneCode: async () => new Promise((resolve) => { resolveCodigo = resolve; }),
        password: async () => new Promise((resolve) => { resolveSenha = resolve; }),
        onError: (err) => console.log('Aviso do Telegram:', err.message),
      }).then(() => {
        const sessaoFinal = tempClient.session.save();
        console.log('====================================================');
        console.log('🎉 TELEGRAM_SESSION GERADA COM SUCESSO NA RENDER:');
        console.log(sessaoFinal);
        console.log('====================================================');
      }).catch(e => {
        console.log('Erro no processo start:', e.message);
      });
    } catch (e) {
      console.log('Erro ao instanciar TelegramClient:', e.message);
      loginSession = null;
      return res.status(500).send(`<h2>Erro interno:</h2><p>${e.message}</p>`);
    }

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

  res.send(`
    <h2>Painel de Autenticação ProBusca - Telegram</h2>
    <p>Insira o seu número de telemóvel com DDI e DDD:</p>
    <form action="/login" method="GET">
      <input type="text" name="telefone" value="+5549991017850" style="padding:12px; font-size:18px; width:280px;" required>
      <button type="submit" style="padding:12px 20px; font-size:18px; background:#007bff; color:#fff; border:none;">Solicitar Código</button>
    </form>
  `);
});

// ==========================================
// API DE CONSULTA
// ==========================================
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
