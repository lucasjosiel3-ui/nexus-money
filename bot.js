const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');

const client = new Client();

let confirmacoes = {};

// 🔑 GERAR SENHA TEMP
function gerarSenhaTemp() {
    return Math.random().toString(36).slice(-6);
}

// 🔢 Gerar nome único
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

    // 👤 CADASTRO
    if (texto !== 'dashboard' && texto !== 'saldo' && texto !== 'resetar') {

        const numeroLimpo = numero.replace('@c.us', '');

        // 🔥 BUSCA USUÁRIO NO SERVER
        let res = await fetch(`https://nexus-money-production-39d6.up.railway.app/api/buscar/${numeroLimpo}`);
        let user = await res.json();

        if (!user || user.aguardandoNome) {

            if (!user || !user.nome) {
                return msg.reply(`👋 Olá! Eu sou o *Nexus Money* 💰

Qual seu nome?`);
            }

            const nomeBase = texto.replace(/\s+/g, '');

            if (!nomeBase) {
                return msg.reply('❌ Digite um nome válido');
            }

            const nomeFinal = gerarNomeUnico(nomeBase);
            const senhaTemp = gerarSenhaTemp();

            await fetch(`https://nexus-money-production-39d6.up.railway.app/api/criar-usuario/${numeroLimpo}/${nomeFinal}/${senhaTemp}`);

            return msg.reply(`✅ Cadastro concluído!

👤 Usuário: *${nomeFinal}*
🔑 Senha: *${senhaTemp}*

🌐 Acesse seu painel:
https://nexus-money-production-39d6.up.railway.app/login/${numeroLimpo}`);
        }

        // 💰 RECEITA
        if (texto.startsWith('receita')) {

            const partes = texto.split('|').map(p => p.trim());
            const valor = parseFloat(partes[1].replace(',', '.'));

            await fetch(`https://nexus-money-production-39d6.up.railway.app/api/receita/${numeroLimpo}/${valor}`);

            return msg.reply(`💰 Receita registrada!`);
        }

        // 💸 DESPESA
        if (texto.startsWith('despesa')) {

            const partes = texto.split('|').map(p => p.trim());
            const valor = parseFloat(partes[1].replace(',', '.'));
            const categoria = partes[3];

            await fetch(`https://nexus-money-production-39d6.up.railway.app/api/despesa/${numeroLimpo}/${valor}/${categoria}`);

            return msg.reply(`💸 Despesa registrada!`);
        }

        // 📅 AGENDAR CONTA
        if (texto.startsWith('agendar')) {

            const partes = texto.split('|').map(p => p.trim());

            const valor = parseFloat(partes[1].replace(',', '.'));
            const descricao = partes[2];
            const tipo = partes[3];
            const data = partes[4];

            await fetch(`https://nexus-money-production-39d6.up.railway.app/api/adicionar-conta/${numeroLimpo}/${descricao}/${valor}/${data}/${tipo}`);

            return msg.reply(`📅 Conta agendada com sucesso!`);
        }

        // 📊 DASHBOARD
        if (texto === 'dashboard') {

            return msg.reply(`🌐 Acesse seu painel:

https://nexus-money-production-39d6.up.railway.app/login/${numeroLimpo}`);
        }

        // 🧹 RESET
        if (texto === 'resetar') {

            confirmacoes[numero] = true;

            return msg.reply(`⚠️ Tem certeza?

Digite *CONFIRMAR*`);
        }

        if (texto === 'confirmar' && confirmacoes[numero]) {

            await fetch(`https://nexus-money-production-39d6.up.railway.app/api/deletar-usuario/${numeroLimpo}`);

            delete confirmacoes[numero];

            return msg.reply(`👋 Reset concluído.

Qual seu nome?`);
        }
    }

});

client.initialize();