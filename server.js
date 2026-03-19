const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');

// 👇 BANCO DE DADOS
const mongoose = require('mongoose');

mongoose.connect(process.env.URL_MONGO);

// 👇 MODEL DO USUÁRIO
const User = mongoose.model('User', {
    numero: String,
    nome: String,
    receitas: Number,
    despesas: Array,
    contas: Array,
    senha: String,
    senhaTemp: String
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'nexusmoney123',
    resave: false,
    saveUninitialized: true
}));

// 🚀 API CRIAR / ATUALIZAR USUÁRIO
app.get('/api/criar-usuario/:numero/:nome/:senha', async (req, res) => {

    const numero = req.params.numero + '@c.us';
    let nome = req.params.nome;
    let senha = req.params.senha;

    if (nome === '_' || nome === 'null') nome = null;
    if (senha === '_' || senha === 'null') senha = null;

    let user = await User.findOne({ numero });

    if (!user) {
        user = await User.create({
            numero,
            nome: nome || null,
            receitas: 0,
            despesas: [],
            contas: [],
            senhaTemp: senha || null
        });

        return res.send({ status: 'criado' });
    }

    if (nome) user.nome = nome;
    if (senha) user.senhaTemp = senha;

    await user.save();

    res.send({ status: 'atualizado' });
});

// 💰 RECEITA
app.get('/api/receita/:numero/:valor/:descricao/:data', async (req, res) => {

    const numero = req.params.numero + '@c.us';

    const user = await User.findOne({ numero });

    if (!user) return res.send('Usuário não encontrado');

    const valor = parseFloat(req.params.valor);

    user.receitas = (user.receitas || 0) + valor;

    await user.save();

    res.send({ status: 'ok' });
});


// 💸 DESPESA
app.get('/api/despesa/:numero/:valor/:descricao/:categoria/:data', async (req, res) => {

    const numero = req.params.numero + '@c.us';

    const user = await User.findOne({ numero });

    if (!user) return res.send('Usuário não encontrado');

    if (!user.despesas) user.despesas = [];

    user.despesas.push({
        valor: parseFloat(req.params.valor),
        descricao: req.params.descricao,
        categoria: req.params.categoria,
        data: req.params.data
    });

    await user.save();

    res.send({ status: 'ok' });
});

// 📅 BUSCAR CONTAS (BOT)
app.get('/api/contas/:numero', async (req, res) => {

    const numero = req.params.numero + '@c.us';

    const user = await User.findOne({ numero });

    if (!user) return res.json([]);

    res.json(user.contas || []);
});

// 👥 TODOS USUÁRIOS (BOT)
app.get('/api/usuarios', async (req, res) => {

    const users = await User.find({});

    res.json(users);
});

// 🔍 BUSCAR USUÁRIO
app.get('/api/buscar/:numero', async (req, res) => {

    const numero = req.params.numero + '@c.us';

    try {
        const user = await User.findOne({ numero });
        res.json(user || null);
    } catch (err) {
        res.status(500).json({ erro: 'Erro interno' });
    }
});

// 🔄 SINCRONIZAR CONTAS (BOT → SERVER)
app.post('/api/sync-contas', async (req, res) => {

    const user = req.body;

    await User.updateOne(
        { numero: user.numero },
        { contas: user.contas }
    );

    res.send({ status: 'ok' });
});

// 🧹 DELETAR USUÁRIO
app.get('/api/deletar-usuario/:numero', async (req, res) => {

    const numero = req.params.numero + '@c.us';

    await User.deleteOne({ numero });

    res.send({ status: 'deletado' });
});

// 🔐 LOGIN PELO LINK (🔥 ESSA ERA A QUE FALTAVA)
app.get('/login/:numero', async (req, res) => {

    const numero = req.params.numero + '@c.us';

    const user = await User.findOne({ numero });

    if (!user) return res.send('Usuário não encontrado');

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

    const { numero, senha } = req.body;

    const user = await User.findOne({ numero });

    if (!user) return res.send('Usuário não encontrado');

    // SENHA TEMP
    if (user.senhaTemp && senha === user.senhaTemp) {
        req.session.usuario = numero;
        return res.redirect(`/nova-senha/${numero.replace('@c.us','')}`);
    }

    // SENHA NORMAL
    if (user.senha) {
        const senhaValida = await bcrypt.compare(senha, user.senha);

        if (senhaValida) {
            req.session.usuario = numero;
            return res.redirect(`/user/${numero.replace('@c.us','')}`);
        }
    }

    return res.send('❌ Senha inválida');
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

    const { numero, senha } = req.body;

    const hash = await bcrypt.hash(senha, 10);

    await User.updateOne(
        { numero },
        {
            senha: hash,
            senhaTemp: null
        }
    );

    res.redirect(`/user/${numero.replace('@c.us','')}`);
});

// ✅ PAGAR CONTA
app.get('/pagar/:numero/:index', async (req, res) => {

    const numero = req.params.numero + '@c.us';
    const index = parseInt(req.params.index);

    const user = await User.findOne({ numero });

    if (!user) return res.send('Usuário não encontrado');

    if (user.contas[index]) {
        user.contas[index].pago = true;
    }

    await user.save();

    res.redirect(`/user/${req.params.numero}`);
});

// 📊 DASHBOARD COMPLETO
app.get('/user/:numero', async (req, res) => {

    const numero = req.params.numero + '@c.us';

    // 🔐 PROTEÇÃO
    if (!req.session.usuario || req.session.usuario !== numero) {
        return res.redirect(`/login/${req.params.numero}`);
    }

    const user = await User.findOne({ numero });

    if (!user) return res.send('Usuário não encontrado');

    const despesas = Array.isArray(user.despesas) ? user.despesas : [];
    const contas = Array.isArray(user.contas) ? user.contas : [];

    // 💸 TOTAL DESPESAS
    const totalDespesas = despesas.reduce((s, d) => s + (d.valor || 0), 0);

    // 💰 RECEITAS (caso seja número)
    const totalReceitas = user.receitas || 0;

    // 💰 SALDO
    const saldo = totalReceitas - totalDespesas;

    // 📊 AGRUPAR CATEGORIAS
    const categorias = {};

    despesas.forEach(d => {
        const cat = d.categoria || 'Outros';
        if (!categorias[cat]) categorias[cat] = 0;
        categorias[cat] += d.valor || 0;
    });

    const labelsCategorias = Object.keys(categorias);
    const valoresCategorias = Object.values(categorias);

    const formatar = v => (v || 0).toFixed(2).replace('.', ',');

    // 📅 CONTAS HTML
    let contasHTML = '';

    if (contas.length === 0) {
        contasHTML = '<p>Nenhuma conta agendada.</p>';
    } else {
        contas.forEach((c, i) => {

            const status = c.pago ? '✅ Pago' : '⏳ Pendente';

            const botao = c.pago ? '' : `
            <a href="/pagar/${req.params.numero}/${i}">
                <button style="
                    margin-top:8px;
                    padding:5px 10px;
                    background:#22c55e;
                    border:none;
                    border-radius:5px;
                    cursor:pointer;
                ">
                    Pagar
                </button>
            </a>`;

            contasHTML += `
            <div style="
                background:#020617;
                padding:10px;
                border-radius:10px;
                margin-bottom:10px;
                border-left:5px solid ${c.pago ? '#22c55e' : '#ef4444'};
            ">
                <strong>${c.descricao}</strong><br>
                📅 ${c.data}<br>
                💰 R$ ${formatar(c.valor)}<br>
                ${status}<br>
                ${botao}
            </div>`;
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

<!-- 💰 SALDO -->
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

<!-- 💸 RESUMO -->
<div style="display:flex;gap:10px;margin-bottom:15px;">
    <div style="flex:1;background:#1e293b;padding:15px;border-radius:10px;">
        <h4>Receitas</h4>
        <p>R$ ${formatar(totalReceitas)}</p>
    </div>

    <div style="flex:1;background:#1e293b;padding:15px;border-radius:10px;">
        <h4>Despesas</h4>
        <p>R$ ${formatar(totalDespesas)}</p>
    </div>
</div>

<!-- 📊 GRÁFICO PRINCIPAL -->
<div style="background:#1e293b;padding:20px;border-radius:15px;margin-bottom:20px;">
    <h3>📊 Visão Financeira</h3>
    <canvas id="grafico"></canvas>
</div>

<!-- 📂 CATEGORIAS -->
<div style="background:#1e293b;padding:20px;border-radius:15px;margin-bottom:20px;">
    <h3>📂 Gastos por Categoria</h3>
    <canvas id="graficoCategorias"></canvas>
</div>

<!-- 📅 CONTAS -->
<div style="background:#1e293b;padding:20px;border-radius:15px;">
    <h3>📅 Contas Agendadas</h3>
    ${contasHTML}
</div>

<script>
new Chart(document.getElementById('grafico'), {
    type: 'doughnut',
    data: {
        labels: ['Receitas', 'Despesas'],
        datasets: [{
            data: [${totalReceitas}, ${totalDespesas}],
            backgroundColor: ['#22c55e','#ef4444'],
            borderWidth: 0
        }]
    }
});

new Chart(document.getElementById('graficoCategorias'), {
    type: 'bar',
    data: {
        labels: ${JSON.stringify(labelsCategorias)},
        datasets: [{
            data: ${JSON.stringify(valoresCategorias)},
            backgroundColor: '#ef4444'
        }]
    },
    options: {
        plugins: { legend: { display: false }},
        scales: {
            x: { ticks: { color: '#fff' }},
            y: { ticks: { color: '#fff' }}
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