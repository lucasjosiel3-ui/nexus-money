const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');

const client = new Client();

let confirmacoes = {};

// 🔑 SENHA
function gerarSenhaTemp() {
    return Math.random().toString(36).slice(-6);
}

// 🔢 NOME
function gerarNomeUnico(nomeBase) {
    const numero = Math.floor(Math.random() * 900) + 100;
    return `${nomeBase}${numero}`;
}

// 📅 DATA HOJE
function hojeFormatado() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}`;
}

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot conectado!');
});

// =========================
// 🔥 MENSAGENS
// =========================
client.on('message', async msg => {

    const numero = msg.from;
    const texto = msg.body.toLowerCase().trim();
    const numeroLimpo = numero.split('@')[0];

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

        const partes = texto.split('|').map(p => p.trim());
        const valor = parseFloat(partes[1].replace(',', '.'));

        const descricao = partes[2] || '---';
        const data = partes[3] || hojeFormatado();

        await fetch(`https://nexus-money-production-39d6.up.railway.app/api/receita/${numeroLimpo}/${valor}/${descricao}/${data}`);

        return msg.reply(`💰 Receita registrada!

📌 ${descricao}
📅 ${data}
💵 R$${valor}`);
    }

    // 💸 DESPESA
    if (texto.startsWith('despesa')) {

        const partes = texto.split('|').map(p => p.trim());
        const valor = parseFloat(partes[1].replace(',', '.'));

        const descricao = partes[2] || '---';
        const categoria = partes[3] || 'Outros';
        const data = partes[4] || hojeFormatado();

        await fetch(`https://nexus-money-production-39d6.up.railway.app/api/despesa/${numeroLimpo}/${valor}/${descricao}/${categoria}/${data}`);

        return msg.reply(`💸 Despesa registrada!

📌 ${descricao}
📂 ${categoria}
📅 ${data}
💰 R$${valor}`);
    }

    // 📅 AGENDAR
    if (texto.startsWith('agendar')) {

        const partes = texto.split('|').map(p => p.trim());

        const valor = parseFloat(partes[1].replace(',', '.'));
        const descricao = partes[2];
        const tipo = partes[3] || 'avulsa';
        const data = partes[4];

        await fetch(`https://nexus-money-production-39d6.up.railway.app/api/adicionar-conta/${numeroLimpo}/${descricao}/${valor}/${data}/${tipo}`);

        return msg.reply(`📅 Conta agendada!

📌 ${descricao}
💰 R$${valor}
📅 ${data}`);
    }

    // 🌐 DASHBOARD
    if (texto === 'dashboard') {
        return msg.reply(`🌐 Acesse:

https://nexus-money-production-39d6.up.railway.app/login/${numeroLimpo}`);
    }

    // 🧹 RESET
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

// =========================
// 🔔 LEMBRETES (3x ao dia)
// =========================
setInterval(async () => {

    const agora = new Date();
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');

    const horaAtual = `${hora}:${minuto}`;
    const horarios = ['07:00', '13:00', '19:00'];

    if (!horarios.includes(horaAtual)) return;

    console.log('🔔 Verificando contas...');

    // 🔥 aqui depois podemos integrar melhor com mongo
}, 60000);


// =========================
// 📊 RESUMO DIÁRIO
// =========================
setInterval(async () => {

    const agora = new Date();
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');

    if (`${hora}:${minuto}` !== '21:00') return;

    console.log('📊 Enviando resumo diário...');

}, 60000);


client.initialize();