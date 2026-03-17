const express = require('express');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'nexusmoney123',
    resave: false,
    saveUninitialized: true
}));

// 🔑 GERAR SENHA TEMP
function gerarSenhaTemp() {
    return Math.random().toString(36).slice(-6);
}

// 🏠 HOME
app.get('/', (req, res) => {
    res.send(`
    <html>
    <body style="background:#0f172a;color:white;display:flex;justify-content:center;align-items:center;height:100vh;">
        <div style="background:#1e293b;padding:30px;border-radius:10px;">
            <h1>💰 Nexus Money</h1>
            <input id="numero" placeholder="5584999999999">
            <button onclick="entrar()">Acessar</button>
        </div>

        <script>
            function entrar() {
                const numero = document.getElementById('numero').value;
                window.location.href = '/login/' + numero;
            }
        </script>
    </body>
    </html>
    `);
});

// 🔐 LOGIN (GERA SENHA SE NÃO EXISTIR)
app.get('/login/:numero', (req, res) => {

    let dados = fs.existsSync('dados.json')
        ? JSON.parse(fs.readFileSync('dados.json'))
        : {};

    const numero = req.params.numero + '@c.us';
    const user = dados[numero];

    if (!user) return res.send('Usuário não encontrado');

    // 🔥 GERA SENHA TEMP AUTOMÁTICA
    if (!user.senha && !user.senhaTemp) {

        const senhaTemp = gerarSenhaTemp();
        user.senhaTemp = senhaTemp;

        fs.writeFileSync('dados.json', JSON.stringify(dados, null, 2));

        return res.send(`
        <html>
        <body style="background:#0f172a;color:white;text-align:center;padding:40px;">
            <h2>🔐 Primeiro acesso</h2>

            <p>Sua senha temporária:</p>
            <h1>${senhaTemp}</h1>

            <p>Use essa senha para entrar:</p>

            <a href="/login-form/${req.params.numero}">
                <button style="padding:10px;background:#22c55e;border:none;">Ir para login</button>
            </a>
        </body>
        </html>
        `);
    }

    res.redirect(`/login-form/${req.params.numero}`);
});

// 🔐 FORM LOGIN
app.get('/login-form/:numero', (req, res) => {
    res.send(`
    <html>
    <body style="background:#0f172a;color:white;display:flex;justify-content:center;align-items:center;height:100vh;">
        <form method="POST" action="/login" style="background:#1e293b;padding:30px;border-radius:10px;">
            <h2>Login</h2>
            <input type="hidden" name="numero" value="${req.params.numero}@c.us">
            <input type="password" name="senha" placeholder="Senha" required>
            <button>Entrar</button>
        </form>
    </body>
    </html>
    `);
});

// 🔐 VALIDAR LOGIN
app.post('/login', async (req, res) => {

    let dados = JSON.parse(fs.readFileSync('dados.json'));

    const { numero, senha } = req.body;
    const user = dados[numero];

    if (!user) return res.send('Usuário não encontrado');

    // 🔐 SENHA TEMP
    if (user.senhaTemp && senha === user.senhaTemp) {
        req.session.usuario = numero;
        req.session.temp = true;
        return res.redirect(`/nova-senha/${numero.replace('@c.us','')}`);
    }

    // 🔐 SENHA NORMAL
    const senhaValida = await bcrypt.compare(senha, user.senha || '');

    if (!senhaValida) return res.send('❌ Senha inválida');

    req.session.usuario = numero;

    res.redirect(`/user/${numero.replace('@c.us','')}`);
});

// 🔐 NOVA SENHA
app.get('/nova-senha/:numero', (req, res) => {
    res.send(`
    <html>
    <body style="background:#0f172a;color:white;display:flex;justify-content:center;align-items:center;height:100vh;">
        <form method="POST" action="/nova-senha" style="background:#1e293b;padding:30px;border-radius:10px;">
            <h2>Criar nova senha</h2>
            <input type="hidden" name="numero" value="${req.params.numero}@c.us">
            <input type="password" name="senha" required>
            <button>Salvar</button>
        </form>
    </body>
    </html>
    `);
});

app.post('/nova-senha', async (req, res) => {

    let dados = JSON.parse(fs.readFileSync('dados.json'));

    const { numero, senha } = req.body;

    const hash = await bcrypt.hash(senha, 10);

    dados[numero].senha = hash;
    delete dados[numero].senhaTemp;

    fs.writeFileSync('dados.json', JSON.stringify(dados, null, 2));

    res.redirect(`/user/${numero.replace('@c.us','')}`);
});

// 📊 DASHBOARD
app.get('/user/:numero', (req, res) => {

    const numero = req.params.numero + '@c.us';

    if (!req.session.usuario || req.session.usuario !== numero) {
        return res.redirect(`/login/${req.params.numero}`);
    }

    let dados = JSON.parse(fs.readFileSync('dados.json'));
    const user = dados[numero];

    const despesas = Array.isArray(user.despesas) ? user.despesas : [];

    const totalDespesas = despesas.reduce((s, d) => s + (d.valor || 0), 0);
    const saldo = user.receitas - totalDespesas;

    const formatar = v => v.toFixed(2).replace('.', ',');

    res.send(`
    <html>
    <head>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body style="background:#020617;color:white;font-family:Arial;padding:20px;">

        <h2>👋 ${user.nome}</h2>

        <p>💰 Saldo: R$ ${formatar(saldo)}</p>
        <p>💸 Despesas: R$ ${formatar(totalDespesas)}</p>

        <canvas id="grafico"></canvas>

        <script>
            new Chart(document.getElementById('grafico'), {
                type: 'doughnut',
                data: {
                    labels: ['Receitas', 'Despesas'],
                    datasets: [{
                        data: [${user.receitas}, ${totalDespesas}]
                    }]
                }
            });
        </script>

    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log("Servidor rodando em http://localhost:3000");
});