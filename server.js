const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const botUsername = process.env.TELEGRAM_BOT_USERNAME;

// ==========================================
// LISTA DE UTILIZADORES AUTORIZADOS
// ==========================================
// Você pode adicionar quantos utilizadores quiser aqui no formato "utilizador": "senha"
// Ou usar as variáveis de ambiente da Render caso prefira.
const UTILIZADORES_AUTORIZADOS = {
  [process.env.PAINEL_USER || 'admin']: process.env.PAINEL_PASS || '123456',
  'adriel': 'senha123',
  'convidado': 'busca2026'
  'Ricardo': '141812'
};

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
      console.log('✅ Sessão conectada com sucesso!');
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
// ROTA DE LOGIN DO PAINEL (/auth)
// ==========================================
app.get('/auth', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ProBusca - Login</title>
    <style>
        :root {
            --neon-cyan: #00f0ff;
            --text-main: #e2e8f0;
            --text-muted: #94a3b8;
        }
        body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(rgba(11, 15, 25, 0.85), rgba(11, 15, 25, 0.92)), 
                        url('https://i.ibb.co/8D7J6LY4/images-2.jpg') no-repeat center center fixed;
            background-size: cover;
            color: var(--text-main);
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 90vh;
        }
        .card {
            background-color: rgba(19, 27, 46, 0.85);
            backdrop-filter: blur(14px);
            border: 1px solid rgba(0, 240, 255, 0.25);
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 0 35px rgba(0, 240, 255, 0.2);
            width: 100%;
            max-width: 400px;
            box-sizing: border-box;
        }
        h2 {
            margin-top: 0;
            text-align: center;
            color: var(--neon-cyan);
            letter-spacing: 2px;
            text-shadow: 0 0 12px rgba(0, 240, 255, 0.4);
        }
        label { display: block; margin-top: 15px; color: var(--text-muted); font-size: 14px; }
        input {
            width: 100%; padding: 14px; margin-top: 6px;
            background-color: rgba(11, 15, 25, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px; color: var(--text-main); box-sizing: border-box; font-size: 15px;
        }
        input:focus { outline: none; border-color: var(--neon-cyan); box-shadow: 0 0 10px rgba(0, 240, 255, 0.3); }
        button {
            width: 100%; padding: 14px; margin-top: 25px;
            background: linear-gradient(135deg, var(--neon-cyan), #0077ff);
            color: #0b0f19; border: none; border-radius: 8px;
            cursor: pointer; font-weight: 700; font-size: 16px;
            box-shadow: 0 0 15px rgba(0, 240, 255, 0.3); transition: 0.3s;
        }
        button:hover { opacity: 0.95; box-shadow: 0 0 25px rgba(0, 240, 255, 0.5); }
        .erro { color: #f87171; text-align: center; margin-top: 15px; font-size: 14px; }
    </style>
</head>
<body>
<div class="card">
    <h2>AUTENTICAÇÃO</h2>
    <form action="/auth" method="POST">
        <label>Utilizador:</label>
        <input type="text" name="usuario" required autocomplete="off">
        <label>Senha:</label>
        <input type="password" name="senha" required>
        <button type="submit">ENTRAR NO PAINEL</button>
    </form>
    ${req.query.erro ? '<div class="erro">Utilizador ou senha incorretos!</div>' : ''}
</div>
</body>
</html>
  `);
});

app.post('/auth', (req, res) => {
  const { usuario, senha } = req.body;
  
  // Valida se o utilizador existe na lista e se a senha confere
  if (UTILIZADORES_AUTORIZADOS[usuario] && UTILIZADORES_AUTORIZADOS[usuario] === senha) {
    res.cookie('auth_token', 'logado_com_sucesso', { httpOnly: true, maxAge: 86400000 });
    return res.redirect('/');
  }
  res.redirect('/auth?erro=1');
});

// Middleware de proteção
function verificarAutenticacao(req, res, next) {
  if (req.cookies && req.cookies.auth_token === 'logado_com_sucesso') {
    return next();
  }
  res.redirect('/auth');
}

// ==========================================
// ROTA PRINCIPAL: FRONT-END (PROTEGIDO)
// ==========================================
app.get('/', verificarAutenticacao, (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ProBusca - Painel Customizado</title>
    <style>
        :root {
            --neon-cyan: #00f0ff;
            --text-main: #e2e8f0;
            --text-muted: #94a3b8;
        }

        body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(rgba(11, 15, 25, 0.82), rgba(11, 15, 25, 0.90)), 
                        url('https://i.ibb.co/8D7J6LY4/images-2.jpg') no-repeat center center fixed;
            background-size: cover;
            color: var(--text-main);
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 90vh;
        }

        .card {
            background-color: rgba(19, 27, 46, 0.82);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border: 1px solid rgba(0, 240, 255, 0.25);
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 0 35px rgba(0, 240, 255, 0.2);
            width: 100%;
            max-width: 480px;
            box-sizing: border-box;
        }

        h2 {
            margin-top: 0;
            text-align: center;
            color: var(--neon-cyan);
            letter-spacing: 2px;
            font-weight: 700;
            text-shadow: 0 0 12px rgba(0, 240, 255, 0.4);
        }

        label {
            display: block;
            margin-top: 18px;
            font-weight: 500;
            color: var(--text-muted);
            font-size: 14px;
        }

        select, input {
            width: 100%;
            padding: 14px;
            margin-top: 6px;
            background-color: rgba(11, 15, 25, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: var(--text-main);
            box-sizing: border-box;
            font-size: 15px;
            transition: all 0.3s ease;
        }

        select:focus, input:focus {
            outline: none;
            border-color: var(--neon-cyan);
            box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
        }

        button {
            width: 100%;
            padding: 14px;
            margin-top: 25px;
            background: linear-gradient(135deg, var(--neon-cyan), #0077ff);
            color: #0b0f19;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 700;
            font-size: 16px;
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
            box-shadow: 0 0 15px rgba(0, 240, 255, 0.3);
        }

        button:hover {
            opacity: 0.95;
            box-shadow: 0 0 25px rgba(0, 240, 255, 0.5);
            transform: translateY(-1px);
        }

        pre {
            background-color: rgba(11, 15, 25, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: #38bdf8;
            padding: 15px;
            border-radius: 8px;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 250px;
            overflow-y: auto;
            font-size: 13px;
            margin-top: 25px;
            font-family: 'Courier New', Courier, monospace;
        }

        .download-box {
            margin-top: 15px;
            text-align: center;
        }

        .btn-download {
            display: inline-block;
            background: #10b981;
            color: #fff;
            padding: 10px 20px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
            font-size: 14px;
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
            transition: 0.3s;
        }

        .btn-download:hover {
            background: #059669;
        }

        .links {
            margin-top: 20px;
            text-align: center;
            font-size: 13px;
        }

        .links a {
            color: var(--text-muted);
            text-decoration: none;
            transition: color 0.2s;
            margin: 0 10px;
        }

        .links a:hover {
            color: var(--neon-cyan);
            text-decoration: underline;
        }
    </style>
</head>
<body>

<div class="card">
    <h2>PROBUSCA</h2>
    
    <label for="tipo">Tipo de Consulta</label>
    <select id="tipo">
        <option value="telefone">Telefone</option>
        <option value="nome">Nome</option>
        <option value="cpf">CPF</option>
        <option value="cnpj">CNPJ</option>
        <option value="email">E-mail</option>
        <option value="placa">Placa</option>
    </select>

    <label for="termo">Termo a Pesquisar</label>
    <input type="text" id="termo" value="49991017850" placeholder="Digite o valor...">

    <button onclick="realizarConsulta()">EXECUTAR CONSULTA</button>

    <pre id="resultado">Aguardando comando...</pre>
    
    <div id="containerDownload" class="download-box" style="display:none;">
        <a id="linkDownload" href="#" target="_blank" class="btn-download">📥 Baixar Arquivo Anexado</a>
    </div>

    <div class="links">
        <a href="/login" target="_blank">Gerir Conexão</a>
        <a href="/logout">Sair</a>
    </div>
</div>

<script>
    async function realizarConsulta() {
        const tipo = document.getElementById('tipo').value;
        const termo = document.getElementById('termo').value;
        const resultadoBox = document.getElementById('resultado');
        const containerDownload = document.getElementById('containerDownload');

        if (!termo) {
            alert('Por favor, preencha o termo de busca.');
            return;
        }

        resultadoBox.textContent = 'Processando consulta, aguarde...';
        containerDownload.style.display = 'none';

        try {
            const resposta = await fetch('/api/consultar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo, termo })
            });

            const dados = await resposta.json();

            if (resposta.ok) {
                resultadoBox.textContent = dados.resultado || 'Resposta recebida em anexo.';
                if (dados.arquivoBase64) {
                    const link = document.getElementById('linkDownload');
                    link.href = \`data:\${dados.mimeType || 'application/octet-stream'};base64,\${dados.arquivoBase64}\`;
                    link.download = dados.nomeArquivo || 'resultado_documento.bin';
                    containerDownload.style.display = 'block';
                }
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

app.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/auth');
});

// ==========================================
// PAINEL DE AUTENTICAÇÃO DO TELEGRAM (/login)
// ==========================================
app.get('/login', verificarAutenticacao, async (req, res) => {
  const { telefone, codigo, senha } = req.query;

  if (codigo && resolveCodigo) {
    resolveCodigo(codigo);
    resolveCodigo = null;
    return res.send(`<h2>Código recebido! A processar...</h2><p>Verifique os logs da Render em instantes.</p>`);
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
        onError: (err) => console.log('Aviso:', err.message),
      }).then(() => {
        const sessaoFinal = tempClient.session.save();
        console.log('====================================================');
        console.log('🎉 CHAVE DE SESSÃO GERADA COM SUCESSO:');
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
      <h2>Confirmação de Acesso</h2>
      <p>Insira o código enviado para o número <b>${telefoneTemp}</b>.</p>
      <form action="/login" method="GET">
        <input type="text" name="codigo" placeholder="Ex: 12345" style="padding:12px; font-size:18px;" required>
        <button type="submit" style="padding:12px 20px; font-size:18px; background:#00f0ff; color:#0b0f19; border:none; font-weight:bold;">Enviar Código</button>
      </form>
    `);
  }

  res.send(`
    <h2>Painel de Autenticação</h2>
    <p>Insira o número de telemóvel com DDI e DDD:</p>
    <form action="/login" method="GET">
      <input type="text" name="telefone" value="+5549991017850" style="padding:12px; font-size:18px; width:280px;" required>
      <button type="submit" style="padding:12px 20px; font-size:18px; background:#00f0ff; color:#0b0f19; border:none; font-weight:bold;">Solicitar Código</button>
    </form>
  `);
});

// ==========================================
// API DE CONSULTA (PROTEGIDA)
// ==========================================
app.post('/api/consultar', verificarAutenticacao, async (req, res) => {
  const { tipo, termo } = req.body;
  if (!tipo || !termo) return res.status(400).json({ erro: 'Informe o tipo e o termo.' });

  const comandoBase = MAPA_COMANDOS[tipo.toLowerCase()];
  if (!comandoBase) return res.status(400).json({ erro: 'Tipo não suportado.' });

  const mensagemParaEnviar = `${comandoBase} ${termo.trim()}`;

  try {
    if (telegramClient && telegramClient.connected && botUsername) {
      const msgEnviada = await telegramClient.sendMessage(botUsername, { message: mensagemParaEnviar });
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const mensagens = await telegramClient.getMessages(botUsername, { limit: 3 });
      const respostaBot = mensagens.find((m) => m.id > msgEnviada.id && !m.out);

      if (!respostaBot) {
        return res.status(504).json({ erro: 'O serviço demorou para responder.' });
      }

      let respostaTexto = respostaBot.message || '';
      let arquivoBase64 = null;
      let nomeArquivo = null;
      let mimeType = null;

      if (respostaBot.media) {
        try {
          const bufferArquivo = await telegramClient.downloadMedia(respostaBot.media, {});
          if (bufferArquivo) {
            arquivoBase64 = bufferArquivo.toString('base64');
            const docAttr = respostaBot.media.document?.attributes?.find(attr => attr.className === 'DocumentAttributeFilename');
            nomeArquivo = docAttr ? docAttr.fileName : 'resultado_documento.bin';
            mimeType = respostaBot.media.document?.mimeType || 'application/octet-stream';
          }
        } catch (downloadErr) {
          console.log('Erro ao baixar mídia:', downloadErr.message);
        }
      }

      return res.json({ 
        sucesso: true, 
        comandoExecutado: tipo, 
        resultado: respostaTexto,
        arquivoBase64,
        nomeArquivo,
        mimeType
      });
    }
    return res.status(503).json({ erro: 'Serviço temporariamente indisponível.' });
  } catch (error) {
    console.error('Erro geral na consulta:', error);
    res.status(500).json({ erro: 'Erro interno ao processar a consulta.' });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
