const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');

// 👇 BANCO DE DADOS
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URL);

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

app.use(session({
    secret: 'nexusmoney123',
    resave: false,
    saveUninitialized: true
}));

// 🔑 GERAR SENHA TEMP
function gerarSenhaTemp() {
    return Math.random().toString(36).slice(-6);
}

// 🚀 API CRIAR USUÁRIO
app.get('/api/criar-usuario/:numero/:nome/:senha', async (req, res) => {

    const numero = req.params.numero + '@c.us';
    const nome = req.params.nome;
    const senha = req.params.senha;

    const existe = await User.findOne({ numero });

    if (!existe) {
        await User.create({
            numero,
            nome,
            receitas: 0,
            despesas: [],
            contas: [],
            senhaTemp: senha
        });
    }

    res.send({ status: 'ok' });
});

// 🚀 API ADICIONAR CONTA (MONGO)
app.get('/api/adicionar-conta/:numero/:descricao/:valor/:data/:tipo', async (req, res) => {

    const numero = req.params.numero + '@c.us';

    const user = await User.findOne({ numero });

    if (!user) return res.send('Usuário não encontrado');

    if (!user.contas) user.contas = [];

    user.contas.push({
        descricao: req.params.descricao,
        valor: parseFloat(req.params.valor),
        data: req.params.data,
        tipo: req.params.tipo,
        pago: false,
        notificado: false
    });

    await user.save();

    res.send({ status: 'ok' });
});

// 🧹 API DELETAR USUÁRIO
app.get('/api/deletar-usuario/:numero', async (req, res) => {

    const numero = req.params.numero + '@c.us';

    await User.deleteOne({ numero });

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
app.get('/login/:numero', async (req, res) => {

    const numero = req.params.numero + '@c.us';
    const user = await User.findOne({ numero });

    if (!user) return res.send('Usuário não encontrado');

    if (!user.senha && !user.senhaTemp) {

        const senhaTemp = gerarSenhaTemp();
        user.senhaTemp = senhaTemp;
        await user.save();

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

    const { numero, senha } = req.body;

    const user = await User.findOne({ numero });

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

// ✅ MARCAR CONTA COMO PAGA (MONGO)
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

// 📊 DASHBOARD
app.get('/user/:numero', async (req, res) => {

    const numero = req.params.numero + '@c.us';

    if (!req.session.usuario || req.session.usuario !== numero) {
        return res.redirect(`/login/${req.params.numero}`);
    }

    const user = await User.findOne({ numero });

    const despesas = Array.isArray(user.despesas) ? user.despesas : [];
    const contas = Array.isArray(user.contas) ? user.contas : [];

    const totalDespesas = despesas.reduce((s, d) => s + (d.valor || 0), 0);

    const categorias = {};

    despesas.forEach(d => {
        const cat = d.categoria || 'Outros';
        if (!categorias[cat]) categorias[cat] = 0;
        categorias[cat] += d.valor || 0;
    });

    const labelsCategorias = Object.keys(categorias);
    const valoresCategorias = Object.values(categorias);

    const totalReceitas = user.receitas || 0;
    const saldo = totalReceitas - totalDespesas;

    const formatar = v => v.toFixed(2).replace('.', ',');

    let contasHTML = '';

    if (contas.length === 0) {
        contasHTML = '<p>Nenhuma conta agendada.</p>';
    } else {
        contas.forEach((c, i) => {

            const status = c.pago ? '✅ Pago' : '⏳ Pendente';

            const botao = c.pago ? '' : `
            <a href="/pagar/${req.params.numero}/${i}">
                <button style="margin-top:8px;padding:5px 10px;background:#22c55e;border:none;border-radius:5px;cursor:pointer;">
                    Pagar
                </button>
            </a>`;

            contasHTML += `
            <div style="background:#020617;padding:10px;border-radius:10px;margin-bottom:10px;border-left:5px solid ${c.pago ? '#22c55e' : '#ef4444'};">
                <strong>${c.descricao}</strong><br>
                📅 ${c.data}<br>
                💰 R$ ${formatar(c.valor)}<br>
                ${status}<br>${botao}
            </div>`;
        });
    }

    res.send(`...`);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});