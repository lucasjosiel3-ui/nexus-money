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

// 🔑 GERAR SENHA TEMP
function gerarSenhaTemp() {
    return Math.random().toString(36).slice(-6);
}

// 💾 Salvar
function salvarDados() {
    fs.writeFileSync('dados.json', JSON.stringify(dados, null, 2));
}

// 🔄 CARREGAR SEMPRE ATUALIZADO
function carregarDados() {
    if (fs.existsSync('dados.json')) {
        return JSON.parse(fs.readFileSync('dados.json'));
    }
    return {};
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
	const senhaTemp = gerarSenhaTemp();

        user.nome = nomeFinal;
	user.aguardandoNome = false;

	salvarDados();

	// 🚀 CRIA USUÁRIO NO SERVIDOR
	const numeroLimpo = numero.replace('@c.us', '');

await fetch(`https://nexus-money-production-39d6.up.railway.app/api/criar-usuario/${numeroLimpo}/${nomeFinal}/${senhaTemp}`);

return msg.reply(`✅ Cadastro concluído!

👤 Usuário: *${nomeFinal}*
🔑 Senha: *${senhaTemp}*

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

    // 📅 DATA DE HOJE
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const hojeFormatado = `${dia}/${mes}`;

    if (!Array.isArray(user.receitas)) {
        user.receitas = [];
    }

    user.receitas.push({
        valor,
        descricao: partes[2],
        fonte: partes[3],
        data: partes[4] || hojeFormatado // 🔥 AQUI
    });

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
        data: partes[4] || hojeFormatado
    });

    salvarDados();

    msg.reply(`💸 *Despesa registrada!*

📌 Descrição: ${partes[2]}
📁 Categoria: ${partes[3]}
📅 Data: ${partes[4]}
💰 Valor: R$${valor}`);
    }

// 📅 AGENDAR CONTA
else if (texto.startsWith('agendar')) {

    const partes = texto.split('|').map(p => p.trim());

    const valor = parseFloat(partes[1]?.replace(',', '.'));
    const descricao = partes[2];
    const tipo = partes[3];
    const data = partes[4];

    // ❌ VALIDAÇÕES
    if (!valor || isNaN(valor)) {
        return msg.reply('❌ Valor inválido.\n\nEx: agendar | 50 | Netflix | fixa | 20/03');
    }

    if (!descricao) {
        return msg.reply('❌ Informe a descrição da conta');
    }

    if (!data || !data.includes('/')) {
        return msg.reply('❌ Data inválida. Use: 20/03');
    }

    // 📂 TIPO PADRÃO
    let tipoFinal = 'avulsa';
    if (tipo && tipo.toLowerCase() === 'fixa') {
        tipoFinal = 'fixa';
    }

    // 🚫 EVITAR DUPLICIDADE
    const jaExiste = user.contas.some(c => 
        c.descricao === descricao &&
        c.data === data &&
        c.valor === valor
    );

    if (jaExiste) {
        return msg.reply('⚠️ Essa conta já foi cadastrada.');
    }

    // 💾 SALVAR
    user.contas.push({
    valor,
    descricao,
    tipo: tipoFinal,
    data,
    pago: false,
    notificado: false // 🔥 NECESSÁRIO
    });

    // 📅 ORDENAR POR DATA
    user.contas.sort((a, b) => {
        const [d1, m1] = a.data.split('/');
        const [d2, m2] = b.data.split('/');
        return new Date(2025, m1-1, d1) - new Date(2025, m2-1, d2);
    });

    salvarDados();

// 🚀 ENVIA PRO SERVER
const numeroLimpo = numero.replace('@c.us', '');

await fetch(`https://nexus-money-production-39d6.up.railway.app/api/adicionar-conta/${numeroLimpo}/${descricao}/${valor}/${data}/${tipoFinal}`);

    // 📆 VERIFICAR SE É HOJE
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const hojeFormatado = `${dia}/${mes}`;

    let alerta = '';
    if (data === hojeFormatado) {
        alerta = '\n⚠️ Essa conta vence HOJE!';
    }

    // 💬 RESPOSTA PROFISSIONAL
    return msg.reply(`📅 *Conta agendada com sucesso!*

👤 ${user.nome}

📌 ${descricao}
💰 R$${valor.toFixed(2).replace('.', ',')}
📅 ${data}
📂 Tipo: ${tipoFinal}${alerta}

💡 Use *dashboard* para acompanhar`);
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

// 📊 RESUMO DIÁRIO AUTOMÁTICO
setInterval(() => {

    let dados = carregarDados();

    const agora = new Date();
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');

    const horaAtual = `${hora}:${minuto}`;

    // ⏰ HORÁRIO DO RESUMO
    if (horaAtual !== '21:00') return;

    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const hoje = `${dia}/${mes}`;

    for (let numero in dados) {

        const user = dados[numero];

        const receitasHoje = user.receitas || 0;

        const despesasHoje = (user.despesas || []).filter(d => d.data === hoje);

        const totalDespesas = despesasHoje.reduce((s, d) => s + d.valor, 0);

        const saldo = receitasHoje - totalDespesas;

        if (receitasHoje === 0 && totalDespesas === 0) continue;

        // 🧠 MAIOR GASTO
        let maior = despesasHoje.sort((a, b) => b.valor - a.valor)[0];

        // 📊 PORCENTAGEM
        let porcentagem = receitasHoje > 0
            ? Math.round((totalDespesas / receitasHoje) * 100)
            : 0;

        // 💡 DICA INTELIGENTE
        let dica = '';

        if (porcentagem > 80) {
            dica = '⚠️ Você gastou quase toda sua renda hoje.';
        } else if (porcentagem > 50) {
            dica = '⚠️ Fique atento aos seus gastos.';
        } else {
            dica = '✅ Controle financeiro saudável hoje!';
        }

        // 💬 MENSAGEM
        let mensagem = `📊 *Resumo do seu dia*

👤 ${user.nome}

💰 Receitas: R$${receitasHoje.toFixed(2).replace('.', ',')}
💸 Despesas: R$${totalDespesas.toFixed(2).replace('.', ',')}
📈 Saldo: R$${saldo.toFixed(2).replace('.', ',')}

📊 Você gastou ${porcentagem}% da sua renda

📌 Maior gasto: ${maior?.descricao || '---'} (R$${maior?.valor || 0})

${dica}

💡 Use *dashboard* para ver detalhes completos`;

        client.sendMessage(numero, mensagem);
    }

}, 60000);

// 🌐 DASHBOARD
 if (texto === 'dashboard') {

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

// 🔔 LEMBRETES + CONFIRMAÇÃO AUTOMÁTICA
setInterval(() => {

    let dados = carregarDados(); // 🔥 sempre atualiza

    const agora = new Date();
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');

    const horaAtual = `${hora}:${minuto}`;
    const horarios = ['07:00', '13:00', '19:00'];

    if (!horarios.includes(horaAtual)) return;

    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const hoje = `${dia}/${mes}`;

    for (let numero in dados) {

        const user = dados[numero];
        if (!user.contas) continue;

        // 🔔 LEMBRETE
        const contasPendentes = user.contas.filter(c =>
            !c.pago && c.data === hoje
        );

        if (contasPendentes.length > 0) {

            let mensagem = `🔔 *Lembrete de contas*\n\n`;

            contasPendentes.forEach(c => {
                mensagem += `📌 ${c.descricao}\n💰 R$${c.valor}\n📅 ${c.data}\n\n`;
            });

            mensagem += '👉 Responda com "✅" para pagar';

            client.sendMessage(numero, mensagem);
        }

        // ✅ CONFIRMA PAGAMENTO AUTOMÁTICO
        user.contas.forEach(c => {

            if (c.pago && !c.notificado) {

                client.sendMessage(numero,
`✅ *Pagamento confirmado!*

📌 ${c.descricao}
💰 R$${c.valor.toFixed(2).replace('.', ',')}

Seu controle financeiro está atualizado 💰`
                );

                c.notificado = true;
            }

        });
    }

    // 💾 SALVA ALTERAÇÕES (IMPORTANTÍSSIMO)
    fs.writeFileSync('dados.json', JSON.stringify(dados, null, 2));

}, 60000);

client.initialize();