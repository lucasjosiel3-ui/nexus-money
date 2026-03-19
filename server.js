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

// 🚀 SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});