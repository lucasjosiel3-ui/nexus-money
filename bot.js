const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');

const client = new Client();

let confirmacoes = {};

// 🔑 SENHA TEMP
function gerarSenhaTemp() {
    return Math.random().toString(36).slice(-6);
}

// 🔢 NOME
function gerarNomeUnico(nomeBase) {
    const numero = Math.floor(Math.random() * 900) + 100;
    return `${nomeBase}${numero}`;
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
    const numeroLimpo = numero.replace('@c.us', '');

    let res = await fetch(`https://nexus-money-production-39d6.up.railway.app/api/buscar/${numeroLimpo}`);
    let user = await res.json();

    // 👤 PRIMEIRO CONTATO
    if (!user) {

        await fetch(`https://nexus-money-production-39d6.up.railway.app/api/criar-usuario/${numeroLimpo}/_/_`);

        return msg.reply(`👋 Olá! Eu sou o *Nexus Money* 💰

Qual seu nome?`);
    }

    // 👤 CADASTRO
    if (!user.nome) {

        // 🚫 BLOQUEAR COMANDOS
        if (
            texto.startsWith('agendar') ||
            texto.startsWith('receita') ||
            texto.startsWith('despesa')
        ) {
            return msg.reply('⚠️ Me diga seu nome primeiro 😊');
        }

        const nomeBase = texto.replace(/\s+/g, '');

        if (!nomeBase || nomeBase.length < 3) {
            return msg.reply('❌ Digite um nome válido');
        }

        const nomeFinal = gerarNomeUnico(nomeBase);
        const senhaTemp = gerarSenhaTemp();

        await fetch(`https://nexus-money-production-39d6.up.railway.app/api/criar-usuario/${numeroLimpo}/${nomeFinal}/${senhaTemp}`);

        return msg.reply(`✅ Cadastro concluído!

👤 ${nomeFinal}
🔑 Senha: ${senhaTemp}

🌐 https://nexus-money-production-39d6.up.railway.app/login/${numeroLimpo}`);
    }

    // 💰 RECEITA
    if (texto.startsWith('receita')) {

        const partes = texto.split('|');
        const valor = parseFloat(partes[1].replace(',', '.'));

        await fetch(`https://nexus-money-production-39d6.up.railway.app/api/receita/${numeroLimpo}/${valor}`);

        return msg.reply('💰 Receita registrada!');
    }

    // 💸 DESPESA
    if (texto.startsWith('despesa')) {

        const partes = texto.split('|');
        const valor = parseFloat(partes[1].replace(',', '.'));
        const categoria = partes[3];

        await fetch(`https://nexus-money-production-39d6.up.railway.app/api/despesa/${numeroLimpo}/${valor}/${categoria}`);

        return msg.reply('💸 Despesa registrada!');
    }

    // 📅 AGENDAR
    if (texto.startsWith('agendar')) {

        const partes = texto.split('|');

        await fetch(`https://nexus-money-production-39d6.up.railway.app/api/adicionar-conta/${numeroLimpo}/${partes[2]}/${partes[1]}/${partes[4]}/${partes[3]}`);

        return msg.reply('📅 Conta agendada!');
    }

    if (texto === 'resetar') {
        confirmacoes[numero] = true;
        return msg.reply('Digite CONFIRMAR');
    }

    if (texto === 'confirmar' && confirmacoes[numero]) {

        await fetch(`https://nexus-money-production-39d6.up.railway.app/api/deletar-usuario/${numeroLimpo}`);

        delete confirmacoes[numero];

        return msg.reply('Reset feito. Qual seu nome?');
    }

});

client.initialize();