const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" } // Permite que seu HTML (Vercel/GitHub Pages) se conecte aqui
});

const PORT = process.env.PORT || 3000;

// Objeto para guardar as salas ativas na memória do servidor
const salas = {};

io.on('connection', (socket) => {
    console.log(`Usuário conectado: ${socket.id}`);

    // Evento 1: Criar uma nova sala
    socket.on('criar_sala', () => {
        const codigoSala = Math.random().toString(36).substring(2, 6).toUpperCase(); // Gera código ex: A7B2
        salas[codigoSala] = {
            id: codigoSala,
            jogadores: [socket.id],
            elencos: {},
            status: 'aguardando'
        };
        socket.join(codigoSala);
        socket.emit('sala_criada', codigoSala);
        console.log(`Sala ${codigoSala} criada pelo usuário ${socket.id}`);
    });

    // Evento 2: Entrar em uma sala existente
    socket.on('entrar_sala', (codigoSala) => {
        const sala = salas[codigoSala];
        
        if (!sala) {
            socket.emit('erro', 'Sala não encontrada.');
            return;
        }
        if (sala.jogadores.length >= 2) {
            socket.emit('erro', 'A sala já está cheia.');
            return;
        }

        sala.jogadores.push(socket.id);
        socket.join(codigoSala);
        sala.status = 'drafting';
        
        // Avisa os dois jogadores que a partida/draft pode começar
        io.to(codigoSala).emit('jogo_iniciado', {
            salaId: codigoSala,
            jogadores: sala.jogadores
        });
        console.log(`Usuário ${socket.id} entrou na sala ${codigoSala}`);
    });

    // Evento 3: Sincronizar escolhas do Draft
    socket.on('jogador_escolhido', ({ codigoSala, player, slotId }) => {
        const sala = salas[codigoSala];
        if (sala) {
            // Repassa para o outro jogador qual carta foi escolhida e em qual posição
            socket.to(codigoSala).emit('adversario_escolheu', { player, slotId });
        }
    });

    // Evento 4: Sincronizar eventos de gol em tempo real
    socket.on('gol_marcado', ({ codigoSala, quem Marcou, minuto, time }) => {
        const sala = salas[codigoSala];
        if (sala) {
            socket.to(codigoSala).emit('gol_recebido', { quem Marcou, minuto, time });
        }
    });

    // Evento 5: Tratar desconexões
    socket.on('disconnect', () => {
        console.log(`Usuário desconectado: ${socket.id}`);
        // Limpa a sala da memória se alguém cair
        for (const codigo in salas) {
            if (salas[codigo].jogadores.includes(socket.id)) {
                io.to(codigo).emit('erro', 'O adversário se desconectou.');
                delete salas[codigo];
            }
        }
    });
});

http.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});