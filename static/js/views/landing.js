document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username-input');
    const roomIdInput = document.getElementById('room-id-input');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const createRoomBtn = document.getElementById('create-room-btn');

    // Se já estiver autenticado, redireciona para primeira sala ou permite criar nova
    if (api.isAuthenticated()) {
        api.getCurrentSession().then(session => {
            if (session.joined_rooms.length > 0) {
                // Se tem salas, vai para a primeira
                window.location.href = `/sala/${session.joined_rooms[0]}`;
            }
            // Se não tem salas, fica na landing para criar uma nova
            usernameInput.value = session.username;
            usernameInput.disabled = true; // Username já definido
        }).catch(() => {
            // Se sessão inválida, limpa token
            api.clearAuthToken();
        });
    }

    const createSession = async () => {
        const username = usernameInput.value.trim();
        if (!username) {
            alert('Por favor, preencha seu nome ou apelido.');
            return null;
        }

        try {
            await api.createSession(username);
            return username;
        } catch (error) {
            alert(error.message || 'Erro ao criar sessão.');
            return null;
        }
    };

    createRoomBtn.addEventListener('click', async () => {
        // Cria sessão se não existir
        if (!api.isAuthenticated() && !await createSession()) return;

        try {
            const data = await api.criarNovaSala();
            window.location.href = `/sala/${data.room_id}`;
        } catch (error) {
            console.error(error);
            alert('Não foi possível criar a sala.');
        }
    });

    joinRoomBtn.addEventListener('click', async () => {
        const roomId = roomIdInput.value.trim();
        if (!roomId) {
            alert('Por favor, preencha o código da sala.');
            return;
        }

        // Cria sessão se não existir
        if (!api.isAuthenticated() && !await createSession()) return;

        try {
            const salaExiste = await api.verificarSeSalaExiste(roomId);
            if (salaExiste) {
                // Tenta entrar na sala primeiro
                await api.joinRoom(roomId);
                window.location.href = `/sala/${roomId}`;
            } else {
                alert('Erro: Sala não encontrada. Verifique o código e tente novamente.');
            }
        } catch (error) {
            console.error(error);
            alert('Não foi possível conectar ao servidor.');
        }
    });

    // Enter key support
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createRoomBtn.click();
    });

    roomIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinRoomBtn.click();
    });
});
