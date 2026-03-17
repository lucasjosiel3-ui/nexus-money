const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const client = new Client();

let dados = {};
let confirmacoes = {};

// 🔄 Carregar dados
if (fs.existsSync('dados.json')) {
    dados = JSON.parse(fs.readFileSync('dados.json'));
}

// 💾 Salvar
function salvarDados() {
    fs.writeFileSync('dados.json', JSON.stringify(dados, null, 2));
}

// 🔢 Gerar nome único
function gerarNomeUnico(nomeBase) {
    const numero = Math.floor(Math.random() * 900) + 100;
    return `${nomeBase}${numero}`;
}

// 👤 Usuário
function getUser(numero) {
    if (!dados[numero]) {
        dados[numero] = {
            nome: null,
            aguardandoNome: true,
            receitas: 0,
            despesas: [],
            contas: []
        };
    }

    if (!Array.isArray(dados[numero].despesas)) {
        dados[numero].despesas = [];
    }

    return dados[numero];
}

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot conectado!');
});

client.on('message', msg => {

    const numero = msg.from;
    const texto = msg.body.toLowerCase().trim();
    const user = getUser(numero);

    // 👤 CADASTRO
    if (user.aguardandoNome) {

        if (!user.nome) {
            user.nome = "__esperando__";
            salvarDados();

            return msg.reply(`👋 Olá! Eu sou o *Nexus Money* 💰

Qual seu nome?`);
        }

        const nomeBase = texto.replace(/\s+/g, '');

        if (!nomeBase || nomeBase === "__esperando__") {
            return msg.reply('❌ Digite um nome válido');
        }

        const nomeFinal = gerarNomeUnico(nomeBase);

        user.nome = nomeFinal;
        user.aguardandoNome = false;

        salvarDados();

        return msg.reply(`✅ Cadastro concluído!

Bem-vindo, *${nomeFinal}*!`);
    }

    // 🧹 CONFIRMAR RESET
    if (texto === 'confirmar' && confirmacoes[numero]) {

        dados[numero] = {
            nome: user.nome,
            aguardandoNome: false,
            receitas: 0,
            despesas: [],
            contas: []
        };

        salvarDados();
        delete confirmacoes[numero];

        return msg.reply(`🧹 *Dados apagados com sucesso!*

Digite *dashboard* para acessar novamente.`);
    }

    // 💰 RECEITA
    if (texto.startsWith('receita')) {
        const partes = texto.split('|').map(p => p.trim());
        const valor = parseFloat(partes[1]?.replace(',', '.'));

        if (isNaN(valor)) {
            return msg.reply('❌ Valor inválido.\nUse: receita | 1000 | salario | empresa | 16/03');
        }

        user.receitas += valor;
        salvarDados();

        return msg.reply(`💰 ${user.nome}, receita registrada!

Valor: R$${valor.toFixed(2).replace('.', ',')}`);
    }

    // 💸 DESPESA
    else if (texto.startsWith('despesa')) {
        const partes = texto.split('|').map(p => p.trim());
        const valor = parseFloat(partes[1]?.replace(',', '.'));

        if (isNaN(valor)) {
            return msg.reply('❌ Valor inválido.\nUse: despesa | 100 | mercado | alimentação | 16/03');
        }

        user.despesas.push({
            valor,
            descricao: partes[2],
            categoria: partes[3],
            data: partes[4]
        });

        salvarDados();

        return msg.reply(`💸 ${user.nome}, despesa registrada!

Valor: R$${valor.toFixed(2).replace('.', ',')}`);
    }

    // 📊 RELATÓRIO
    else if (texto === 'relatorio') {

        if (user.despesas.length === 0) {
            return msg.reply('📊 Nenhuma despesa registrada ainda.');
        }

        let categorias = {};
        let total = 0;

        user.despesas.forEach(d => {
            if (!categorias[d.categoria]) {
                categorias[d.categoria] = 0;
            }

            categorias[d.categoria] += d.valor;
            total += d.valor;
        });

        let resposta = `📊 *Relatório de Gastos*\n\n`;

        for (let cat in categorias) {
            resposta += `📂 ${cat}: R$${categorias[cat].toFixed(2).replace('.', ',')}\n`;
        }

        resposta += `\n💸 Total: R$${total.toFixed(2).replace('.', ',')}`;

        return msg.reply(resposta);
    }

    // 🧠 ANÁLISE INTELIGENTE
    else if (texto.startsWith('analise')) {

        if (user.despesas.length === 0) {
            return msg.reply('🧠 Nenhuma despesa registrada.');
        }

        let totalDespesas = user.despesas.reduce((s, d) => s + d.valor, 0);
        let receitas = user.receitas;

        let porcentagem = receitas > 0
            ? ((totalDespesas / receitas) * 100).toFixed(0)
            : 0;

        let categorias = {};
        user.despesas.forEach(d => {
            categorias[d.categoria] = (categorias[d.categoria] || 0) + d.valor;
        });

        let maiorCategoria = Object.keys(categorias).reduce((a, b) =>
            categorias[a] > categorias[b] ? a : b
        );

        let alerta = '';
        if (porcentagem >= 80) alerta = '⚠️ Gastos muito altos!';
        else if (porcentagem >= 50) alerta = '⚠️ Atenção com seus gastos';
        else alerta = '✅ Controle financeiro OK';

        return msg.reply(`🧠 *Análise Financeira*

📊 Você gastou ${porcentagem}% da sua renda

📂 Maior gasto: ${maiorCategoria}

${alerta}

💡 Dica: reduza gastos em ${maiorCategoria}`);
    }

    // 🌐 DASHBOARD
    else if (texto === 'dashboard') {

        const numeroLimpo = numero.replace('@c.us', '');

        return msg.reply(`🌐 ${user.nome}, acesse seu painel:

🔗 http://localhost:3000/login/${numeroLimpo}`);
    }

    // 🧹 RESET
    else if (texto === 'resetar') {

        confirmacoes[numero] = true;

        return msg.reply(`⚠️ ${user.nome}, tem certeza?

Digite *CONFIRMAR* para apagar tudo.`);
    }

    // 📊 SALDO
    else if (texto === 'saldo') {

        const totalDespesas = user.despesas.reduce((s, d) => s + d.valor, 0);
        const saldo = user.receitas - totalDespesas;

        return msg.reply(`💰 ${user.nome}, saldo atual:

R$${saldo.toFixed(2).replace('.', ',')}`);
    }

});

client.initialize();