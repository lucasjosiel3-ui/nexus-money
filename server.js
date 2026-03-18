const express = require('express');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'nexusmoney123',
    resave: false,
    saveUninitialized: true
}));

// 🔥 GARANTE QUE O ARQUIVO EXISTE
if (!fs.existsSync('dados.json')) {
    fs.writeFileSync('dados.json', JSON.stringify({}, null, 2));
}

// 🔑 GERAR SENHA TEMP
function gerarSenhaTemp() {
    return Math.random().toString(36).slice(-6);
}

// 🚀 API CRIAR USUÁRIO
app.get('/api/criar-usuario/:numero/:nome/:senha', (req, res) => {

    let dados = JSON.parse(fs.readFileSync('dados.json'));

    const numero = req.params.numero + '@c.us';
    const nome = req.params.nome;
    const senha = req.params.senha;

    if (!dados[numero]) {
        dados[numero] = {
            nome: nome,
            aguardandoNome: false,
            receitas: 0,
            despesas: [],
            contas: [],
            senhaTemp: senha // 🔥 SALVA SENHA
        };

        fs.writeFileSync('dados.json', JSON.stringify(dados, null, 2));
    }

    res.send({ status: 'ok' });
});

// 🧹 API DELETAR USUÁRIO
app.get('/api/deletar-usuario/:numero', (req, res) => {

    let dados = JSON.parse(fs.readFileSync('dados.json'));

    const numero = req.params.numero + '@c.us';

    if (dados[numero]) {
        delete dados[numero];
        fs.writeFileSync('dados.json', JSON.stringify(dados, null, 2));
    }

    res.send({ status: 'deletado' });
});

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

// 🔐 LOGIN
app.get('/login/:numero', (req, res) => {

    let dados = JSON.parse(fs.readFileSync('dados.json'));

    const numero = req.params.numero + '@c.us';
    const user = dados[numero];

    if (!user) return res.send('Usuário não encontrado');

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

    if (user.senhaTemp && senha === user.senhaTemp) {
        req.session.usuario = numero;
        return res.redirect(`/nova-senha/${numero.replace('@c.us','')}`);
    }

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
    const contas = Array.isArray(user.contas) ? user.contas : [];

    const totalDespesas = despesas.reduce((s, d) => s + (d.valor || 0), 0);
    const saldo = user.receitas - totalDespesas;

    const formatar = v => v.toFixed(2).replace('.', ',');

// 📅 GERAR HTML DAS CONTAS
let contasHTML = '';

if (contas.length === 0) {
    contasHTML = '<p>Nenhuma conta agendada.</p>';
} else {
    contas.forEach(c => {
        contasHTML += `
            <div style="
                background:#020617;
                padding:10px;
                border-radius:10px;
                margin-bottom:10px;
            ">
                <strong>${c.descricao || 'Conta'}</strong><br>
                📅 ${c.data || '---'}<br>
                💰 R$ ${formatar(c.valor || 0)}
            </div>
        `;
    });
}
    res.send(`
   <html>
<head>
    <title>${user.nome}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>

<body style="background:#020617;color:white;font-family:Arial;padding:20px;">

    <h2>👋 ${user.nome}</h2>

    <div style="
        background:linear-gradient(135deg,#22c55e,#16a34a);
        padding:20px;
        border-radius:15px;
        color:black;
        margin-bottom:15px;
    ">
        <h3>Saldo</h3>
        <p style="font-size:20px;">R$ ${formatar(saldo)}</p>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:15px;">
        <div style="flex:1;background:#1e293b;padding:15px;border-radius:10px;">
            <h4>Receitas</h4>
            <p>R$ ${formatar(user.receitas)}</p>
        </div>

        <div style="flex:1;background:#1e293b;padding:15px;border-radius:10px;">
            <h4>Despesas</h4>
            <p>R$ ${formatar(totalDespesas)}</p>
        </div>
    </div>

    <!-- 📊 GRÁFICO -->
    <div style="
        background:#1e293b;
        padding:20px;
        border-radius:15px;
        margin-bottom:20px;
    ">
        <h3>📊 Visão Financeira</h3>
        <canvas id="grafico"></canvas>
    </div>

    <!-- 📅 CONTAS -->
    <div style="
        background:#1e293b;
        padding:20px;
        border-radius:15px;
    ">
        <h3>📅 Contas Agendadas</h3>
        ${contasHTML}
    </div>

<script>
    new Chart(document.getElementById('grafico'), {
        type: 'doughnut',
        data: {
            labels: ['Receitas', 'Despesas'],
            datasets: [{
                data: [${user.receitas}, ${totalDespesas}],
                backgroundColor: ['#22c55e','#ef4444'],
                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: {
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#fff'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let v = context.raw;
                            return 'R$ ' + v.toFixed(2).replace('.', ',');
                        }
                    }
                }
            }
        }
    });
</script>

    </body>
    </html>
    `);
});

// 🚀 SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});