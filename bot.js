const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const fetch = require('node-fetch');

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

client.on('message', async msg => {

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

	// 🚀 CRIA USUÁRIO NO SERVIDOR
	const numeroLimpo = numero.replace('@c.us', '');

await fetch(`https://nexus-money-production-39d6.up.railway.app/api/criar-usuario/${numeroLimpo}/${nomeFinal}`);

return msg.reply(`✅ Cadastro concluído!

Bem-vindo, *${nomeFinal}*! 👋

🌐 Acesse seu painel:
https://nexus-money-production-39d6.up.railway.app/login/${numeroLimpo}`);
    }

    // 🧹 CONFIRMAR RESET
    if (texto === 'confirmar' && confirmacoes[numero]) {

    const numeroLimpo = numero.replace('@c.us', '');

    // 🧹 APAGA NO SERVIDOR
    await fetch(`https://nexus-money-production-39d6.up.railway.app/api/deletar-usuario/${numeroLimpo}`);

    // 🧹 RESET LOCAL
    dados[numero] = {
        nome: null,
        aguardandoNome: true,
        receitas: 0,
        despesas: [],
        contas: []
    };

    salvarDados();
    delete confirmacoes[numero];

    return msg.reply(`👋 Olá! Eu sou o *Nexus Money* 💰

Vamos começar do zero.

Qual seu nome e sobrenome?`);
    }

    // 💰 RECEITA
   if (texto.startsWith('receita')) {

    const partes = texto.split('|').map(p => p.trim());
    const valor = parseFloat(partes[1].replace(',', '.'));

    user.receitas += valor;
    salvarDados();

    msg.reply(`💰 *Receita registrada!*

📌 Descrição: ${partes[2] || '---'}
🏢 Fonte: ${partes[3] || '---'}
📅 Data: ${partes[4] || '---'}
💵 Valor: R$${valor}`);
    }

    // 💸 DESPESA
    else if (texto.startsWith('despesa')) {

    const partes = texto.split('|').map(p => p.trim());
    const valor = parseFloat(partes[1].replace(',', '.'));

    user.despesas.push({
        valor,
        descricao: partes[2],
        categoria: partes[3],
        data: partes[4]
    });

    salvarDados();

    msg.reply(`💸 *Despesa registrada!*

📌 Descrição: ${partes[2]}
📁 Categoria: ${partes[3]}
📅 Data: ${partes[4]}
💰 Valor: R$${valor}`);
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
    else if (texto === 'analise') {

    const receitas = user.receitas || 0;
    const despesas = user.despesas || [];

    const total = despesas.reduce((s, d) => s + d.valor, 0);

    if (receitas === 0) {
        return msg.reply('⚠️ Você ainda não registrou receitas.');
    }

    const porcentagem = Math.round((total / receitas) * 100);

    let maior = despesas.sort((a, b) => b.valor - a.valor)[0];

    let mensagem = `🧠 *Análise Financeira*

📊 Geral

📁 Maior gasto: ${maior?.descricao || '---'} (R$${maior?.valor || 0})
💸 Total gasto: R$${total}
💰 Receitas: R$${receitas}

📊 Você gastou ${porcentagem}% da sua renda
`;

    if (porcentagem > 70) {
        mensagem += `⚠️ Atenção com seus gastos.\n`;
    }

    if (maior) {
    mensagem += `💡 Dica: tente reduzir gastos em ${maior.descricao}`;
}

return msg.reply(mensagem);
}

// 🌐 DASHBOARD
else if (texto === 'dashboard') {

    const numeroLimpo = numero.replace('@c.us', '');

    return msg.reply(`🌐 ${user.nome}, acesse seu painel:

🔗 https://nexus-money-production-39d6.up.railway.app/login/${numeroLimpo}`);
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