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

// 🚀 API CRIAR / ATUALIZAR USUÁRIO (FIX FINAL)
app.get('/api/criar-usuario/:numero/:nome/:senha', async (req, res) => {

    const numero = req.params.numero + '@c.us';
    let nome = req.params.nome;
    let senha = req.params.senha;

    // 🔥 TRATAR NULL
    if (nome === '_' || nome === 'null') nome = null;
    if (senha === '_' || senha === 'null') senha = null;

    let user = await User.findOne({ numero });

    // 👤 NÃO EXISTE → CRIA
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

    // 🔥 EXISTE → ATUALIZA
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

// 🧹 DELETAR
app.get('/api/deletar-usuario/:numero', async (req, res) => {

    const numero = req.params.numero + '@c.us';

    await User.deleteOne({ numero });

    res.send({ status: 'deletado' });
});

// 🔐 LOGIN (CORRIGIDO)
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

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});